import { NextResponse } from 'next/server';

import { Buffer } from 'node:buffer';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
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
  const existingPapers = await mockDb.listPapers();
  
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

  const paper = await mockDb.createPaper({
    title: extractedTitle,
    extractedTitle,
    leadAuthor,
    year,
    journal,
    doi,
    normalizedDoi,
    duplicateKeyV2,
    titleFingerprint,
    primaryFileSha256: fileSha256,
    originalFileName: file.name,
    uploadedBy: profile?.id ?? null,
  });

  // Upload to Supabase Storage
  let storageInfo: { storageBucket: string; storageObjectPath: string } | null = null;
  try {
    storageInfo = await mockDb.uploadFileToStorage(fileBuffer, file.name, 'papers');
  } catch (storageError) {
    console.error('[POST /api/uploads] Failed to upload to storage:', storageError);
    // Fallback to base64 if storage upload fails
    const base64 = fileBuffer.toString('base64');
    const storedFile = await mockDb.attachFile({
      paperId: paper.id,
      name: file.name,
      originalFileName: file.name,
      size: file.size,
      mimeType: file.type || 'application/pdf',
      dataBase64: base64,
      fileSha256,
      storageBucket: null,
      storageObjectPath: null,
    });

    const updatedPaper = await mockDb.updatePaper(paper.id, {
      primaryFileId: storedFile.id,
      storageBucket: storedFile.storageBucket,
      storageObjectPath: storedFile.storageObjectPath,
    });

    return NextResponse.json({ paper: updatedPaper ?? paper, file: storedFile }, { status: 201 });
  }

  // Store file metadata with storage info (no base64)
  const storedFile = await mockDb.attachFile({
    paperId: paper.id,
    name: file.name,
    originalFileName: file.name,
    size: file.size,
    mimeType: file.type || 'application/pdf',
    dataBase64: null, // Don't store base64 for new uploads
    storageBucket: storageInfo.storageBucket,
    storageObjectPath: storageInfo.storageObjectPath,
    fileSha256,
  });

  const updatedPaper = await mockDb.updatePaper(paper.id, {
    primaryFileId: storedFile.id,
    storageBucket: storedFile.storageBucket,
    storageObjectPath: storedFile.storageObjectPath,
  });

  return NextResponse.json({ paper: updatedPaper ?? paper, file: storedFile }, { status: 201 });
}
