import { Buffer } from 'node:buffer';

import { NextResponse } from 'next/server';

import { computeFileSha256, normalizeDoi } from '@/lib/dedupe';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files can be uploaded for full-text screening' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileSha256 = computeFileSha256(buffer);
  const [existingScreening, existingPapers] = await Promise.all([
    mockDb.listScreeningRecords('full_text'),
    mockDb.listPapers(),
  ]);
  const existingScreeningMatch = existingScreening.find((record) => record.fileSha256 === fileSha256);
  if (existingScreeningMatch) {
    return NextResponse.json(
      {
        error: 'Duplicate screening PDF detected',
        existingRecordId: existingScreeningMatch.id,
        existingStudyId: existingScreeningMatch.assignedStudyId,
        existingTitle: existingScreeningMatch.title,
      },
      { status: 409 },
    );
  }
  const existingPaperMatch = existingPapers.find((paper) => paper.primaryFileSha256 === fileSha256);
  if (existingPaperMatch) {
    return NextResponse.json(
      {
        error: 'PDF already exists in extraction',
        existingPaperId: existingPaperMatch.id,
        existingStudyId: existingPaperMatch.assignedStudyId,
        existingTitle: existingPaperMatch.title,
      },
      { status: 409 },
    );
  }

  let storageInfo: { storageBucket: string; storageObjectPath: string };
  try {
    storageInfo = await mockDb.uploadFileToStorage(buffer, file.name, 'papers');
  } catch (storageError) {
    console.error('[POST /api/full-text-screening/uploads] Storage upload failed:', storageError);
    return NextResponse.json(
      { error: 'PDF storage upload failed. Please retry before adding this record to screening.' },
      { status: 502 },
    );
  }

  const title = ((formData.get('title') as string | null) || file.name).trim();
  const record = await mockDb.createScreeningRecord({
    stage: 'full_text',
    title,
    leadAuthor: (formData.get('leadAuthor') as string | null) || null,
    year: (formData.get('year') as string | null) || null,
    journal: (formData.get('journal') as string | null) || null,
    doi: (formData.get('doi') as string | null) || null,
    sourceLabel: (formData.get('sourceLabel') as string | null) || 'local-upload',
    sourceRecordId: (formData.get('sourceRecordId') as string | null) || null,
    storageBucket: storageInfo.storageBucket,
    storageObjectPath: storageInfo.storageObjectPath,
    dataBase64: null,
    fileName: file.name,
    originalFileName: file.name,
    mimeType: file.type || 'application/pdf',
    size: file.size,
    fileSha256,
    createdBy: profile.id,
    metadata: {
      uploadRoute: '/api/full-text-screening/uploads',
      normalizedDoi: normalizeDoi((formData.get('doi') as string | null) || undefined),
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}
