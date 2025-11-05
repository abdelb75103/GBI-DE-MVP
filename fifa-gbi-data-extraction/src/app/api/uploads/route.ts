import { NextResponse } from 'next/server';

import { Buffer } from 'node:buffer';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import { generateDuplicateKey, calculateFuzzyTitleScore, categorizeDuplicate, doiMatches } from '@/lib/dedupe';

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

  // Check for duplicates before processing the file
  const existingPapers = await mockDb.listPapers();
  
  // 1. Check for exact DOI match
  if (doi) {
    const doiDuplicate = existingPapers.find((paper) => doiMatches(doi, paper.doi));
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

  // 2. Check for exact key match (normalized title + author + year)
  const duplicateKey = generateDuplicateKey(title ?? file.name, leadAuthor, year);
  const exactMatch = existingPapers.find((paper) => {
    const paperKey = generateDuplicateKey(paper.title, paper.leadAuthor, paper.year);
    return paperKey === duplicateKey;
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

  // 3. Check for fuzzy title match
  let highestFuzzyScore = 0;
  let fuzzyMatch: typeof existingPapers[0] | null = null;

  for (const paper of existingPapers) {
    const score = calculateFuzzyTitleScore(title ?? file.name, paper.title);
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

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const paper = await mockDb.createPaper({
    title: title ?? file.name,
    leadAuthor,
    year,
    journal,
    doi,
    uploadedBy: profile?.id ?? null,
  });

  const storedFile = await mockDb.attachFile({
    paperId: paper.id,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/pdf',
    dataBase64: base64,
  });

  const updatedPaper = await mockDb.updatePaper(paper.id, {
    primaryFileId: storedFile.id,
    storageBucket: storedFile.storageBucket,
    storageObjectPath: storedFile.storageObjectPath,
  });

  return NextResponse.json({ paper: updatedPaper ?? paper, file: storedFile }, { status: 201 });
}
