import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const { data, error } = await supabase
  .from('papers')
  .select('id, assigned_study_id, title, status, flag_reason')
  .not('flag_reason', 'is', null);

if (error) {
  throw error;
}

const fifaPapers = (data ?? []).filter((paper) => {
  const reason = normalize(paper.flag_reason ?? '');
  return reason === 'fifa data' || reason === 'fifa';
});

console.log(`Matched ${fifaPapers.length} FIFA-flagged paper(s).`);

for (const paper of fifaPapers) {
  console.log(`${paper.assigned_study_id}\t${paper.status}\t${paper.flag_reason}\t${paper.title}`);
}

if (fifaPapers.length === 0) {
  process.exit(0);
}

const { error: updateError } = await supabase
  .from('papers')
  .update({ status: 'fifa_data' })
  .in(
    'id',
    fifaPapers.map((paper) => paper.id),
  );

if (updateError) {
  throw updateError;
}

console.log('Updated all matched papers to `fifa_data`.');
