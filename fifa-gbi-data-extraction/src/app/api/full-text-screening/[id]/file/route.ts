import { Buffer } from 'node:buffer';

import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import { getAdminServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

const sanitizeFileName = (value: string) => value.replace(/[\r\n"]/g, '').trim() || 'full-text.pdf';

const buildBaseHeaders = (record: Awaited<ReturnType<typeof mockDb.getScreeningRecord>>, fileBuffer: Buffer) => {
  const fileName = sanitizeFileName(record?.fileName || record?.title || 'full-text.pdf');
  const headers = new Headers();
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Content-Disposition', `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  headers.set('Content-Type', record?.mimeType || 'application/pdf');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-PDF-Size', fileBuffer.length.toString());
  return headers;
};

const parseRangeHeader = (rangeHeader: string, fileSize: number) => {
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : fileSize - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
};

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

  const headers = buildBaseHeaders(record, fileBuffer);
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, fileBuffer.length);
    if (!range) {
      headers.set('Content-Range', `bytes */${fileBuffer.length}`);
      headers.set('Content-Length', '0');
      return new NextResponse(null, { status: 416, headers });
    }

    const chunk = fileBuffer.subarray(range.start, range.end + 1);
    headers.set('Content-Length', chunk.length.toString());
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${fileBuffer.length}`);
    return new NextResponse(chunk as unknown as BodyInit, { status: 206, headers });
  }

  headers.set('Content-Length', fileBuffer.length.toString());

  return new NextResponse(fileBuffer as unknown as BodyInit, { status: 200, headers });
}
