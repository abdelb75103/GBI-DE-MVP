import { NextResponse } from 'next/server';

import {
  calculateFuzzyTitleScore,
  categorizeDuplicate,
  doiMatches,
  generateDuplicateKeyV2,
  generateTitleFingerprint,
} from '@/lib/dedupe';
import { mockDb } from '@/lib/mock-db';
import { enrichReference, normalizeImportedDoi, parseReferences } from '@/lib/screening/reference-import';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const MAX_REFERENCE_FILE_BYTES = 6 * 1024 * 1024;
const MAX_IMPORT_ROWS = 350;

const isDuplicate = (
  candidate: { title: string; leadAuthor: string | null; year: string | null; doi: string | null },
  existing: Array<{ title: string; leadAuthor: string | null; year: string | null; doi: string | null; normalizedDoi?: string | null }>,
) => {
  const normalizedDoi = normalizeImportedDoi(candidate.doi);
  if (normalizedDoi && existing.some((record) => doiMatches(normalizedDoi, record.normalizedDoi ?? record.doi))) {
    return { duplicate: true, reason: 'doi' };
  }
  const key = generateDuplicateKeyV2(candidate.title, candidate.leadAuthor, candidate.year);
  const exact = existing.some((record) => generateDuplicateKeyV2(record.title, record.leadAuthor, record.year) === key);
  if (exact) return { duplicate: true, reason: 'title_author_year' };
  const fuzzy = existing.reduce((best, record) => Math.max(best, calculateFuzzyTitleScore(candidate.title, record.title)), 0);
  if (categorizeDuplicate(fuzzy) === 'duplicate') return { duplicate: true, reason: `fuzzy_${fuzzy}` };
  return { duplicate: false, reason: '' };
};

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const sourceLabel = String(formData.get('sourceLabel') || 'reference-import').trim() || 'reference-import';
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No reference file provided' }, { status: 400 });
  }
  if (file.size > MAX_REFERENCE_FILE_BYTES) {
    return NextResponse.json({ error: 'Reference file exceeds 6 MB limit' }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseReferences(text, file.name, sourceLabel).slice(0, MAX_IMPORT_ROWS);
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'No references with titles were found in this file.' }, { status: 400 });
  }

  const existingTitleAbstract = await mockDb.listScreeningRecords('title_abstract');
  const existing = existingTitleAbstract.map((record) => ({
    title: record.title,
    leadAuthor: record.leadAuthor,
    year: record.year,
    doi: record.doi,
    normalizedDoi: record.normalizedDoi,
  }));

  const inserted = [];
  const skipped = [];
  const failures = [];

  for (const reference of parsed) {
    const enriched = await enrichReference(reference);
    const duplicate = isDuplicate(enriched, existing);
    if (duplicate.duplicate) {
      skipped.push({ title: enriched.title, reason: duplicate.reason });
      continue;
    }

    try {
      const normalizedDoi = normalizeImportedDoi(enriched.doi);
      const record = await mockDb.createScreeningRecord({
        stage: 'title_abstract',
        title: enriched.title,
        abstract: enriched.abstract,
        leadAuthor: enriched.leadAuthor,
        journal: enriched.journal,
        year: enriched.year,
        doi: enriched.doi,
        sourceLabel,
        sourceRecordId: enriched.sourceRecordId,
        createdBy: profile.id,
        metadata: {
          importFileName: file.name,
          importSourceLabel: sourceLabel,
          importRaw: enriched.raw,
          enrichment: enriched.enrichment,
          normalizedDoi,
          duplicateKeyV2: generateDuplicateKeyV2(enriched.title, enriched.leadAuthor, enriched.year),
          titleFingerprint: generateTitleFingerprint(enriched.title),
        },
      });
      inserted.push(record);
      existing.push({
        title: record.title,
        leadAuthor: record.leadAuthor,
        year: record.year,
        doi: record.doi,
        normalizedDoi: record.normalizedDoi,
      });
    } catch (error) {
      failures.push({ title: enriched.title, reason: error instanceof Error ? error.message : 'Import failed' });
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    failures,
    totalParsed: parsed.length,
  }, { status: inserted.length > 0 ? 201 : 200 });
}
