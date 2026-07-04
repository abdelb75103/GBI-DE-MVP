import crypto from 'node:crypto';

import { supabaseClient } from '@/lib/db/shared';
import type { PaperDuplicate } from '@/lib/types';
import type { FileRow, PaperDuplicateRow } from '@/lib/db/types';
import {
  calculateFilenameScore,
  calculateFuzzyTitleScore,
  generateDuplicateKeyV2,
  normalizeDoi,
} from '@/lib/dedupe';

type PaperWithDedupe = {
  id: string;
  assignedStudyId: string;
  title: string;
  extractedTitle: string | null;
  normalizedDoi: string | null;
  doi: string | null;
  duplicateKeyV2: string | null;
  primaryFileSha256: string | null;
  originalFileName: string | null;
  primaryFileId: string | null;
  leadAuthor: string | null;
  year: string | null;
};

type DedupeScanPaperRow = {
  id: string;
  assigned_study_id: string | null;
  title: string;
  extracted_title: string | null;
  normalized_doi: string | null;
  doi: string | null;
  duplicate_key_v2: string | null;
  primary_file_sha256: string | null;
  original_file_name: string | null;
  primary_file_id: string | null;
  lead_author: string | null;
  year: string | null;
};

type DedupeScanFileRow = Pick<FileRow, 'id' | 'original_file_name' | 'name'>;

const DEDUPE_SCAN_PAPER_SELECT = [
  'id',
  'assigned_study_id',
  'title',
  'extracted_title',
  'normalized_doi',
  'doi',
  'duplicate_key_v2',
  'primary_file_sha256',
  'original_file_name',
  'primary_file_id',
  'lead_author',
  'year',
].join(',');

const PAGE_SIZE = 1000;

const keyIgnoreOrder = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const keyOrdered = (a: string, b: string) => `${a}:${b}`;

const canonicalPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);
const canonicalKey = (a: string, b: string) => keyOrdered(...canonicalPair(a, b));

const makePairKey = (a: string, b: string) => keyIgnoreOrder(a, b);

const hydratePapers = (rows: DedupeScanPaperRow[]): PaperWithDedupe[] => rows.map((row) => ({
  id: row.id,
  assignedStudyId: row.assigned_study_id ?? '',
  title: row.title,
  extractedTitle: row.extracted_title ?? null,
  normalizedDoi: row.normalized_doi ?? null,
  doi: row.doi ?? null,
  duplicateKeyV2: row.duplicate_key_v2 ?? null,
  primaryFileSha256: row.primary_file_sha256 ?? null,
  originalFileName: row.original_file_name ?? null,
  primaryFileId: row.primary_file_id ?? null,
  leadAuthor: row.lead_author ?? null,
  year: row.year ?? null,
}));

const pickTitle = (paper: PaperWithDedupe) =>
  paper.extractedTitle ?? paper.title ?? paper.originalFileName ?? paper.assignedStudyId;

const pickFilename = (paper: PaperWithDedupe, files: Record<string, DedupeScanFileRow | undefined>) => {
  const primaryFile = files[paper.primaryFileId ?? ''];
  const name = primaryFile?.original_file_name ?? primaryFile?.name ?? paper.originalFileName ?? paper.title;
  return name ?? '';
};

export const listPaperDuplicates = async (): Promise<PaperDuplicate[]> => {
  const supabase = supabaseClient();
  const rows: PaperDuplicateRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('paper_duplicates')
      .select('*')
      .order('detected_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to list duplicate candidates: ${error.message}`);
    }

    const batch = (data ?? []) as PaperDuplicateRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return rows.map((row) => ({
    id: row.id,
    paperIdA: row.paper_id_a,
    paperIdB: row.paper_id_b,
    reason: row.reason,
    score: row.score,
    level: (row.level as PaperDuplicate['level']) ?? 'duplicate',
    status: (row.status as PaperDuplicate['status']) ?? 'unreviewed',
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    notes: row.notes ?? null,
  }));
};

export const resolvePaperDuplicate = async (
  id: string,
  status: PaperDuplicate['status'],
  resolvedBy: string,
  notes?: string | null,
) => {
  const supabase = supabaseClient();
  const { error } = await supabase
    .from('paper_duplicates')
    .update({
      status,
      notes: notes ?? null,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to resolve duplicate ${id}: ${error.message}`);
  }
};

export const scanForDuplicates = async (): Promise<PaperDuplicate[]> => {
  const supabase = supabaseClient();
  const paperRows: DedupeScanPaperRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('papers')
      .select(DEDUPE_SCAN_PAPER_SELECT)
      .order('uploaded_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load papers for dedupe scan: ${error.message}`);
    }

    const batch = (data ?? []) as unknown as DedupeScanPaperRow[];
    paperRows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  const papers = hydratePapers(paperRows);

  if (papers.length === 0) {
    return [];
  }

  // Load files for filename/hash comparison
  const fileRowsTyped: DedupeScanFileRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('paper_files')
      .select('id,original_file_name,name')
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load files for dedupe scan: ${error.message}`);
    }

    const batch = (data ?? []) as DedupeScanFileRow[];
    fileRowsTyped.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  const fileMap = Object.fromEntries(fileRowsTyped.map((row) => [row.id, row]));

  // Existing duplicate records for status preservation
  const existing = await listPaperDuplicates();
  const existingIgnoreOrderMap = new Map(existing.map((row) => [makePairKey(row.paperIdA, row.paperIdB), row]));

  const candidates: PaperDuplicate[] = [];
  const desiredOrderedKeys = new Set<string>();

  for (let i = 0; i < papers.length; i += 1) {
    for (let j = i + 1; j < papers.length; j += 1) {
      const paperA = papers[i];
      const paperB = papers[j];
      const [paperIdA, paperIdB] = canonicalPair(paperA.id, paperB.id);
      const orderedKey = canonicalKey(paperA.id, paperB.id);
      const ignoreOrderKey = orderedKey;
      desiredOrderedKeys.add(orderedKey);

      const normalizedDoiA = normalizeDoi(paperA.normalizedDoi ?? paperA.doi);
      const normalizedDoiB = normalizeDoi(paperB.normalizedDoi ?? paperB.doi);

      const hashA = paperA.primaryFileSha256 ?? null;
      const hashB = paperB.primaryFileSha256 ?? null;

      const keyA = paperA.duplicateKeyV2 ?? generateDuplicateKeyV2(pickTitle(paperA), paperA.leadAuthor, paperA.year);
      const keyB = paperB.duplicateKeyV2 ?? generateDuplicateKeyV2(pickTitle(paperB), paperB.leadAuthor, paperB.year);

      const titleA = pickTitle(paperA);
      const titleB = pickTitle(paperB);
      const fuzzyScore = calculateFuzzyTitleScore(titleA, titleB);

      const filenameScore = calculateFilenameScore(
        pickFilename(paperA, fileMap),
        pickFilename(paperB, fileMap),
      );

      let reason: string | null = null;
      let score: number | null = null;
      let level: PaperDuplicate['level'] = 'duplicate';

      if (normalizedDoiA && normalizedDoiA === normalizedDoiB) {
        reason = 'doi';
        score = 100;
        level = 'duplicate';
      } else if (hashA && hashB && hashA === hashB) {
        reason = 'file_hash';
        score = 100;
        level = 'duplicate';
      } else if (keyA && keyA === keyB) {
        reason = 'exact_key';
        score = 100;
        level = 'duplicate';
      } else if (fuzzyScore >= 92) {
        reason = 'fuzzy_title';
        score = fuzzyScore;
        level = 'duplicate';
      } else if (fuzzyScore >= 85) {
        reason = 'fuzzy_title';
        score = fuzzyScore;
        level = 'possible';
      } else if (filenameScore >= 92) {
        reason = 'filename';
        score = filenameScore;
        level = 'duplicate';
      } else if (filenameScore >= 85) {
        reason = 'filename';
        score = filenameScore;
        level = 'possible';
      }

      if (!reason) {
        continue;
      }

      const existingRow = existingIgnoreOrderMap.get(ignoreOrderKey);
      const id =
        existingRow && existingRow.paperIdA === paperIdA && existingRow.paperIdB === paperIdB
          ? existingRow.id
          : crypto.randomUUID();
      candidates.push({
        id,
        paperIdA,
        paperIdB,
        reason,
        score,
        level,
        status: existingRow?.status ?? 'unreviewed',
        detectedAt: existingRow?.detectedAt ?? new Date().toISOString(),
        resolvedAt: existingRow?.resolvedAt ?? null,
        resolvedBy: existingRow?.resolvedBy ?? null,
        notes: existingRow?.notes ?? null,
      });
    }
  }

  if (candidates.length > 0) {
    const { error: upsertError } = await supabase.from('paper_duplicates').upsert(
      candidates.map((c) => ({
        id: c.id,
        paper_id_a: c.paperIdA,
        paper_id_b: c.paperIdB,
        reason: c.reason,
        score: c.score,
        level: c.level,
        status: c.status,
        detected_at: c.detectedAt,
        resolved_at: c.resolvedAt,
        resolved_by: c.resolvedBy,
        notes: c.notes,
      })),
      { onConflict: 'paper_id_a,paper_id_b' },
    );
    if (upsertError) {
      throw new Error(`Failed to save duplicate candidates: ${upsertError.message}`);
    }
  }

  const staleIds = existing
    .filter((row) => !desiredOrderedKeys.has(canonicalKey(row.paperIdA, row.paperIdB)))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    await supabase.from('paper_duplicates').delete().in('id', staleIds);
  }

  return candidates;
};
