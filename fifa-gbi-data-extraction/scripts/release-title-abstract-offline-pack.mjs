#!/usr/bin/env node
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const RESERVATION_KEY = 'titleAbstractOfflineReservation';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith('--')) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before releasing an offline pack.');
}

const packId = String(args.get('pack-id') || '').trim();
if (!packId) {
  throw new Error('Pass --pack-id <pack-id>.');
}

const reviewerProfileId = String(args.get('reviewer-profile-id') || '').trim();
if (!reviewerProfileId) {
  throw new Error('Pass --reviewer-profile-id <profile-id>.');
}

const apply = Boolean(args.get('apply'));
const confirmImported = Boolean(args.get('confirm-imported'));
const abandon = Boolean(args.get('abandon'));
const reportPath = args.get('report') ? path.resolve(String(args.get('report'))) : null;
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const metadataObject = (metadata) => metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};

const loadReservedRows = async () => {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id, assigned_study_id, metadata, updated_at')
      .eq('stage', 'title_abstract')
      .eq('metadata->titleAbstractOfflineReservation->>packId', packId)
      .eq('metadata->titleAbstractOfflineReservation->>reviewerProfileId', reviewerProfileId)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load reserved records: ${error.message}`);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
};

const allRows = await loadReservedRows();
const rows = allRows.filter((row) => metadataObject(row.metadata)[RESERVATION_KEY]?.status === 'active');
const completedCount = allRows.filter((row) => metadataObject(row.metadata)[RESERVATION_KEY]?.status === 'completed').length;
const releasedCount = allRows.filter((row) => metadataObject(row.metadata)[RESERVATION_KEY]?.status === 'released').length;

if (apply && rows.length > 0 && !confirmImported && !abandon) {
  throw new Error('Refusing to release active reservations without --confirm-imported. Import decisions first, then rerun with --confirm-imported --apply to release unused records. If intentionally discarding an unused pack, pass --abandon --apply.');
}

if (apply && rows.length > 0 && confirmImported && completedCount === 0 && !abandon) {
  throw new Error('Refusing to release because this pack has no completed imported decisions. Import decisions first. If intentionally discarding an unused pack, pass --abandon --apply instead.');
}

const released = [];
const skipped = [];
for (const row of rows) {
  const metadata = metadataObject(row.metadata);
  const nextMetadata = {
    ...metadata,
    [RESERVATION_KEY]: {
      ...metadata[RESERVATION_KEY],
      status: 'released',
      releasedAt: new Date().toISOString(),
      releaseReason: abandon ? 'abandoned_without_import' : 'unused_after_import',
    },
  };
  if (apply) {
    const { data: updated, error: updateError } = await supabase
      .from('screening_records')
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('updated_at', row.updated_at)
      .select('id')
      .maybeSingle();
    if (updateError) throw new Error(`Failed to release ${row.assigned_study_id}: ${updateError.message}`);
    if (!updated) {
      skipped.push({
        recordId: row.id,
        studyId: row.assigned_study_id,
        reason: 'Record changed before release could be written.',
      });
      continue;
    }
  }
  released.push({ recordId: row.id, studyId: row.assigned_study_id });
}

if (reportPath) {
  await fs.writeFile(reportPath, `${JSON.stringify({
    packId,
    reviewerProfileId,
    apply,
    completedCount,
    previouslyReleasedCount: releasedCount,
    activeBeforeRelease: rows.length,
    abandon,
    released,
    skipped,
  }, null, 2)}\n`, 'utf8');
}

console.log(`${apply ? 'Released' : 'Would release'} ${released.length} active reserved records from pack ${packId}.`);
console.log(`Pack status counts: active ${rows.length}, completed ${completedCount}, previously released ${releasedCount}.`);
if (skipped.length > 0) {
  console.log(`Skipped during release because records changed: ${skipped.length}.`);
}
if (!apply) {
  console.log('No database changes were made. Re-run with --apply to release them.');
}
