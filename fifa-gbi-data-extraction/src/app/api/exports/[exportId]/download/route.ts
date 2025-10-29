import { NextRequest, NextResponse } from 'next/server';

import { buildCsvExport, buildJsonExport } from '@/lib/exporters';
import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

const getExportId = (request: NextRequest) => {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((p) => p === 'exports');
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
};

const sanitizeForFilename = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, '-');

export async function GET(request: NextRequest) {
  const exportId = getExportId(request);
  const job = mockDb.getExport(exportId);

  if (!job) {
    return NextResponse.json({ error: 'Export not found' }, { status: 404 });
  }

  const timestamp = sanitizeForFilename(job.createdAt.replace(/[:.]/g, '-'));
  const baseName = `gbi-export-${timestamp || exportId}`;

  if (job.kind === 'csv') {
    const csv = buildCsvExport(job.paperIds);
    const headers = new Headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${baseName}.csv"`,
      'Cache-Control': 'no-store',
    });
    if (job.checksumSha256) headers.set('X-Checksum-SHA256', job.checksumSha256);
    return new Response(csv, { status: 200, headers });
  }

  const data = buildJsonExport(job.paperIds);
  const body = JSON.stringify(data, null, 2);
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${baseName}.json"`,
    'Cache-Control': 'no-store',
  });
  if (job.checksumSha256) headers.set('X-Checksum-SHA256', job.checksumSha256);
  return new Response(body, { status: 200, headers });
}

