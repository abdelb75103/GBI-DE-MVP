import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';

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

  const job = await mockDb.createExport(kind, paperIds);

  return NextResponse.json({ export: job }, { status: 201 });
}
