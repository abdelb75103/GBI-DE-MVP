import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { partitionAnalysisExportPapers } from '@/lib/analysis-source-policy';
import type { Paper } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const exports = await mockDb.listExports();

  return NextResponse.json({ exports });
}

export async function POST(request: Request) {
  const { kind, paperIds } = (await request.json()) as {
    kind?: 'csv' | 'json';
    paperIds?: string[];
  };

  if (!kind || !paperIds || paperIds.length === 0) {
    return NextResponse.json({ error: 'kind and paperIds are required' }, { status: 400 });
  }

  const papers = await Promise.all(paperIds.map((paperId) => mockDb.getPaper(paperId)));
  const { included, excluded } = partitionAnalysisExportPapers(
    papers.filter(Boolean) as Paper[],
  );

  if (included.length === 0) {
    return NextResponse.json(
      { error: 'Selected papers are source-only and are excluded from the analysis export' },
      { status: 422 },
    );
  }

  const job = await mockDb.createExport(kind, included.map((paper) => paper.id));

  return NextResponse.json({
    export: job,
    excludedPapers: excluded.map((paper) => ({
      id: paper.id,
      assignedStudyId: paper.assignedStudyId,
      analysisRole: paper.analysisRole,
    })),
  }, { status: 201 });
}
