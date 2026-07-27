import { NextRequest, NextResponse } from 'next/server';

import { buildPaperCsv, buildJsonExport } from '@/lib/exporters';
import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

const getPaperId = (request: NextRequest) => {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((p) => p === 'papers');
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
};

const sanitizeForFilename = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, '-');

export async function GET(request: NextRequest) {
  const paperId = getPaperId(request);
  const paper = await mockDb.getPaper(paperId);
  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const scope = request.nextUrl.searchParams.get('scope') === 'source' ? 'source' : 'analysis';
  if (scope === 'analysis' && !paper.includeInAnalysisExport) {
    return NextResponse.json(
      {
        error: `${paper.assignedStudyId} is a source-only record and is excluded from the analysis export`,
        analysisRole: paper.analysisRole,
      },
      { status: 409 },
    );
  }

  const format = request.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const base = sanitizeForFilename(`${paper.title ?? 'paper'}-${paper.id}`.toLowerCase());

  if (format === 'csv') {
    const csv = await buildPaperCsv(paperId, { scope });
    const headers = new Headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${base}.csv"`,
      'Cache-Control': 'no-store',
    });
    return new Response(csv, { status: 200, headers });
  }

  const payload = await buildJsonExport([paperId], { scope });
  const record = payload.papers[0];
  const body = JSON.stringify({ generatedAt: payload.generatedAt, paper: record }, null, 2);
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${base}.json"`,
    'Cache-Control': 'no-store',
  });
  return new Response(body, { status: 200, headers });
}
