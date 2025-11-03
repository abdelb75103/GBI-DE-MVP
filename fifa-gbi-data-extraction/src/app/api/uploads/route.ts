import { NextResponse } from 'next/server';

import { Buffer } from 'node:buffer';

import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
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
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const paper = await mockDb.createPaper({
    title: title ?? file.name,
    leadAuthor,
    year,
    journal,
    doi,
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
