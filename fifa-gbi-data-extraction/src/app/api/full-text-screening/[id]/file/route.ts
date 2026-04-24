import { Buffer } from 'node:buffer';

import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import { getAdminServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const record = await mockDb.getScreeningRecord(id);
  if (!record) {
    return NextResponse.json({ error: 'Screening record not found' }, { status: 404 });
  }

  let fileBuffer: Buffer | null = null;
  if (record.storageBucket && record.storageObjectPath) {
    const { data, error } = await getAdminServiceClient()
      .storage
      .from(record.storageBucket)
      .download(record.storageObjectPath);
    if (error) {
      console.error(`[GET /api/full-text-screening/${id}/file] Storage download failed`, error);
    } else if (data) {
      fileBuffer = Buffer.from(await data.arrayBuffer());
    }
  }

  if (!fileBuffer && record.dataBase64) {
    fileBuffer = Buffer.from(record.dataBase64, 'base64');
  }

  if (!fileBuffer) {
    return NextResponse.json({ error: 'File data not available' }, { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', record.mimeType || 'application/pdf');
  headers.set('Content-Length', fileBuffer.length.toString());
  headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(record.fileName || record.title)}"`);
  headers.set('Cache-Control', 'private, max-age=3600');

  return new NextResponse(fileBuffer as unknown as BodyInit, { status: 200, headers });
}
