import { NextResponse } from 'next/server';

import { Buffer } from 'node:buffer';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { UploadQueueItem } from '@/lib/types';
import {
  generateDuplicateKeyV2,
  calculateFuzzyTitleScore,
  categorizeDuplicate,
  doiMatches,
  normalizeDoi,
  generateTitleFingerprint,
  computeFileSha256,
  calculateFilenameScore,
} from '@/lib/dedupe';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const pickUploadTitle = (upload: UploadQueueItem) =>
  upload.extractedTitle ?? upload.title ?? upload.originalFileName ?? upload.fileName;

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  
  const formData = await request.formData();
  const file = formData.get('file');
  const title = (formData.get('title') as string | null) ?? undefined;
  const leadAuthor = (formData.get('leadAuthor') as string | null) ?? undefined;
  const year = (formData.get('year') as string | null) ?? undefined;
  const journal = (formData.get('journal') as string | null) ?? undefined;
  const doi = (formData.get('doi') as string | null) ?? undefined;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const extractedTitle = title ?? file.name;
  const normalizedDoi = normalizeDoi(doi);
  const duplicateKeyV2 = generateDuplicateKeyV2(extractedTitle, leadAuthor, year);
  const titleFingerprint = generateTitleFingerprint(extractedTitle);
  const fileSha256 = computeFileSha256(fileBuffer);

  // Check for duplicates before processing the file
  const [existingPapers, pendingUploads] = await Promise.all([
    mockDb.listPapers(),
    mockDb.listUploadQueueEntries(),
  ]);
  
  // 1. Check for exact DOI match
  if (normalizedDoi) {
    const doiDuplicate = existingPapers.find((paper) => doiMatches(normalizedDoi, paper.normalizedDoi ?? paper.doi));
    if (doiDuplicate) {
      return NextResponse.json(
        {
          error: 'Duplicate paper detected',
          reason: 'doi',
          message: `A paper with this DOI already exists: "${doiDuplicate.title}"`,
          existingPaperId: doiDuplicate.id,
          existingPaperTitle: doiDuplicate.title,
        },
        { status: 409 },
      );
    }
    const pendingDoiDuplicate = pendingUploads.find((upload) =>
      doiMatches(normalizedDoi, upload.normalizedDoi ?? upload.doi),
    );
    if (pendingDoiDuplicate) {
      return NextResponse.json(
        {
          error: 'Duplicate paper detected',
          reason: 'pending_doi',
          message: `A pending upload with this DOI is awaiting approval: "${pickUploadTitle(pendingDoiDuplicate)}"`,
          pendingUploadId: pendingDoiDuplicate.id,
          pendingUploadTitle: pickUploadTitle(pendingDoiDuplicate),
        },
        { status: 409 },
      );
    }
  }

  // 2. Check for exact file hash match
  const fileHashMatch = existingPapers.find((paper) => paper.primaryFileSha256 && paper.primaryFileSha256 === fileSha256);
  if (fileHashMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'file_hash',
        message: `This PDF file matches an existing upload: "${fileHashMatch.title}"`,
        existingPaperId: fileHashMatch.id,
        existingPaperTitle: fileHashMatch.title,
      },
      { status: 409 },
    );
  }
  const pendingHashMatch = pendingUploads.find((upload) => upload.fileSha256 && upload.fileSha256 === fileSha256);
  if (pendingHashMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'pending_file_hash',
        message: `A pending upload already contains this PDF: "${pickUploadTitle(pendingHashMatch)}"`,
        pendingUploadId: pendingHashMatch.id,
        pendingUploadTitle: pickUploadTitle(pendingHashMatch),
      },
      { status: 409 },
    );
  }

  // 3. Check for exact key match (normalized title + author + year)
  const exactMatch = existingPapers.find((paper) => {
    const paperKey = paper.duplicateKeyV2 ?? generateDuplicateKeyV2(paper.extractedTitle ?? paper.title, paper.leadAuthor, paper.year);
    return paperKey === duplicateKeyV2;
  });

  if (exactMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'exact',
        message: `This paper already exists: "${exactMatch.title}"`,
        existingPaperId: exactMatch.id,
        existingPaperTitle: exactMatch.title,
      },
      { status: 409 },
    );
  }
  const pendingExactMatch = pendingUploads.find((upload) => {
    const uploadKey =
      upload.duplicateKeyV2 ?? generateDuplicateKeyV2(pickUploadTitle(upload), upload.leadAuthor, upload.year);
    return uploadKey === duplicateKeyV2;
  });
  if (pendingExactMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'pending_exact',
        message: `A pending upload with this title/author/year already exists: "${pickUploadTitle(pendingExactMatch)}"`,
        pendingUploadId: pendingExactMatch.id,
        pendingUploadTitle: pickUploadTitle(pendingExactMatch),
      },
      { status: 409 },
    );
  }

  // 4. Check for fuzzy title match
  let highestFuzzyScore = 0;
  let fuzzyMatch: typeof existingPapers[0] | null = null;

  for (const paper of existingPapers) {
    const score = calculateFuzzyTitleScore(extractedTitle, paper.extractedTitle ?? paper.title);
    if (score > highestFuzzyScore) {
      highestFuzzyScore = score;
      fuzzyMatch = paper;
    }
  }

  const duplicateLevel = categorizeDuplicate(highestFuzzyScore);

  if (duplicateLevel === 'duplicate' && fuzzyMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'fuzzy',
        message: `This paper appears very similar to an existing paper (${highestFuzzyScore}% match): "${fuzzyMatch.title}"`,
        existingPaperId: fuzzyMatch.id,
        existingPaperTitle: fuzzyMatch.title,
        similarityScore: highestFuzzyScore,
      },
      { status: 409 },
    );
  }

  let pendingHighestFuzzy = 0;
  let pendingFuzzyMatch: UploadQueueItem | null = null;
  for (const upload of pendingUploads) {
    const score = calculateFuzzyTitleScore(extractedTitle, pickUploadTitle(upload));
    if (score > pendingHighestFuzzy) {
      pendingHighestFuzzy = score;
      pendingFuzzyMatch = upload;
    }
  }
  const pendingDuplicateLevel = categorizeDuplicate(pendingHighestFuzzy);
  if (pendingDuplicateLevel === 'duplicate' && pendingFuzzyMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'pending_fuzzy',
        message: `A pending upload appears similar (${pendingHighestFuzzy}% match): "${pickUploadTitle(pendingFuzzyMatch)}"`,
        pendingUploadId: pendingFuzzyMatch.id,
        pendingUploadTitle: pickUploadTitle(pendingFuzzyMatch),
        similarityScore: pendingHighestFuzzy,
      },
      { status: 409 },
    );
  }
  if (pendingDuplicateLevel === 'possible' && pendingFuzzyMatch) {
    return NextResponse.json(
      {
        warning: 'Possible duplicate detected',
        message: `A pending upload may match (${pendingHighestFuzzy}% match): "${pickUploadTitle(pendingFuzzyMatch)}"`,
        pendingUploadId: pendingFuzzyMatch.id,
        pendingUploadTitle: pickUploadTitle(pendingFuzzyMatch),
        similarityScore: pendingHighestFuzzy,
        canProceed: true,
      },
      { status: 409 },
    );
  }

  // 5. Filename similarity as final weak signal
  let filenameScore = 0;
  let filenameMatch: typeof existingPapers[0] | null = null;
  for (const paper of existingPapers) {
    const score = calculateFilenameScore(file.name, paper.originalFileName ?? paper.title);
    if (score > filenameScore) {
      filenameScore = score;
      filenameMatch = paper;
    }
  }

  if (duplicateLevel === 'possible' && fuzzyMatch) {
    return NextResponse.json(
      {
        warning: 'Possible duplicate detected',
        message: `This paper may be similar to an existing paper (${highestFuzzyScore}% match): "${fuzzyMatch.title}"`,
        existingPaperId: fuzzyMatch.id,
        existingPaperTitle: fuzzyMatch.title,
        similarityScore: highestFuzzyScore,
        canProceed: true,
      },
      { status: 409 },
    );
  }

  if (filenameScore >= 92 && filenameMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'filename',
        message: `This filename is nearly identical to an existing upload (${filenameScore}% match): "${filenameMatch.title}"`,
        existingPaperId: filenameMatch.id,
        existingPaperTitle: filenameMatch.title,
        similarityScore: filenameScore,
      },
      { status: 409 },
    );
  }

  if (filenameScore >= 85 && filenameMatch) {
    return NextResponse.json(
      {
        warning: 'Possible duplicate detected',
        message: `This filename is similar to an existing upload (${filenameScore}% match): "${filenameMatch.title}"`,
        existingPaperId: filenameMatch.id,
        existingPaperTitle: filenameMatch.title,
        similarityScore: filenameScore,
        canProceed: true,
      },
      { status: 409 },
    );
  }

  let pendingFilenameScore = 0;
  let pendingFilenameMatch: UploadQueueItem | null = null;
  for (const upload of pendingUploads) {
    const score = calculateFilenameScore(file.name, upload.originalFileName ?? upload.fileName);
    if (score > pendingFilenameScore) {
      pendingFilenameScore = score;
      pendingFilenameMatch = upload;
    }
  }
  if (pendingFilenameScore >= 92 && pendingFilenameMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate paper detected',
        reason: 'pending_filename',
        message: `A pending upload has a very similar filename (${pendingFilenameScore}% match): "${pickUploadTitle(pendingFilenameMatch)}"`,
        pendingUploadId: pendingFilenameMatch.id,
        pendingUploadTitle: pickUploadTitle(pendingFilenameMatch),
        similarityScore: pendingFilenameScore,
      },
      { status: 409 },
    );
  }
  if (pendingFilenameScore >= 85 && pendingFilenameMatch) {
    return NextResponse.json(
      {
        warning: 'Possible duplicate detected',
        message: `A pending upload may be similar (${pendingFilenameScore}% filename match): "${pickUploadTitle(pendingFilenameMatch)}"`,
        pendingUploadId: pendingFilenameMatch.id,
        pendingUploadTitle: pickUploadTitle(pendingFilenameMatch),
        similarityScore: pendingFilenameScore,
        canProceed: true,
      },
      { status: 409 },
    );
  }

  let storageInfo: { storageBucket: string; storageObjectPath: string } | null = null;
  let dataBase64: string | null = null;
  try {
    storageInfo = await mockDb.uploadFileToStorage(fileBuffer, file.name, 'papers');
  } catch (storageError) {
    console.error('[POST /api/uploads] Failed to upload to storage:', storageError);
    dataBase64 = fileBuffer.toString('base64');
  }

  const queuedUpload = await mockDb.queueUpload({
    title: extractedTitle,
    extractedTitle,
    leadAuthor,
    year,
    journal,
    doi,
    normalizedDoi,
    duplicateKeyV2,
    titleFingerprint,
    fileName: file.name,
    originalFileName: file.name,
    mimeType: file.type || 'application/pdf',
    size: file.size,
    fileSha256,
    storageBucket: storageInfo?.storageBucket ?? null,
    storageObjectPath: storageInfo?.storageObjectPath ?? null,
    dataBase64,
    createdBy: profile?.id ?? null,
  });

  return NextResponse.json({ upload: queuedUpload }, { status: 201 });
}
