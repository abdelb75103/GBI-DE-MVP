import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outRoot = path.join(root, 'tmp', 'full-text-skill-validation-2026-06-19');
const pdfRoot = path.join(outRoot, 'blinded-pdfs');

function decisions(metadata) {
  return Array.isArray(metadata?.fullTextDecisions) ? metadata.fullTextDecisions : [];
}

function resolution(row) {
  if (row.promoted_paper_id) return 'include';
  if (row.metadata?.fullTextResolution === 'excluded') return 'exclude';
  if (row.metadata?.fullTextResolution === 'ready_for_extraction') return 'include';
  const votes = decisions(row.metadata);
  if (votes.length === 0 && row.manual_decision) return row.manual_decision;
  if (votes.length < 2) return null;
  if (votes[0]?.decision === votes[1]?.decision) return votes[0].decision;
  return votes[2]?.decision ?? null;
}

function historicalReason(row) {
  if (row.sealed_reason) return row.sealed_reason;
  const reasons = decisions(row.metadata)
    .filter((vote) => vote.decision === 'exclude')
    .map((vote) => String(vote.reason ?? '').trim())
    .filter(Boolean)
    .join(' / ');
  return reasons || String(row.manual_reason ?? '').trim();
}

const includeSlots = [
  { block: 'calibration', family: 'sport_population', re: /beach soccer|futsal|para[- ]?football/i },
  { block: 'calibration', family: 'study_design', re: /randomi[sz]ed|cluster[- ]random|prevention program|intervention study/i },
  { block: 'calibration', family: 'data_source', re: /prospective|surveillance|cohort/i },
  { block: 'calibration', family: 'outcome_definition', re: /illness|mental health|health problems/i },
  { block: 'calibration', family: 'exposure_rate', re: /tournament|world cup|championship/i },
  { block: 'calibration', family: 'publication_subgroup', re: /systematic review|meta-analysis/i },
  { block: 'holdout', family: 'sport_population', re: /referee|match official/i },
  { block: 'holdout', family: 'study_design', re: /#?readytoplay|ostrc|weekly|prospective/i },
  { block: 'holdout', family: 'data_source', re: /prospective|surveillance|cohort/i },
  { block: 'holdout', family: 'outcome_definition', re: /women|female|youth|academy/i },
  { block: 'holdout', family: 'exposure_rate', re: /tournament|world cup|league|season/i },
  { block: 'holdout', family: 'publication_subgroup', re: /Kutnjak|Slovenian|translated/i },
];

const excludeSlots = [
  { block: 'calibration', family: 'sport_population', re: /wrong sport|non-competitive|recreational|walking football|medical intervention/i },
  { block: 'calibration', family: 'study_design', re: /retrospective|cross-sectional|case-control|protocol/i },
  { block: 'calibration', family: 'data_source', re: /public.source|transfermarkt|premierinjuries|register|hospital|database|media/i },
  { block: 'calibration', family: 'outcome_definition', re: /definition|proxy|video|catastrophic|mortality|biomechan|biomarker|imaging|performance/i },
  { block: 'calibration', family: 'exposure_rate', re: /denominator|exposure|numbers|proportions|rate/i },
  { block: 'calibration', family: 'publication_subgroup', re: /narrative|editorial|commentary|subgroup|review article/i },
  { block: 'holdout', family: 'sport_population', re: /wrong sport|non-competitive|recreational|walking football|medical intervention/i },
  { block: 'holdout', family: 'study_design', re: /retrospective|cross-sectional|case-control|protocol/i },
  { block: 'holdout', family: 'data_source', re: /public.source|transfermarkt|premierinjuries|register|hospital|database|media/i },
  { block: 'holdout', family: 'outcome_definition', re: /definition|proxy|video|catastrophic|mortality|biomechan|biomarker|imaging|performance/i },
  { block: 'holdout', family: 'exposure_rate', re: /denominator|exposure|numbers|proportions|rate/i },
  { block: 'holdout', family: 'publication_subgroup', re: /narrative|editorial|commentary|subgroup|review article/i },
];

function pickSlots(slots, candidates, haystack) {
  const used = new Set();
  return slots.map((slot) => {
    let candidate = candidates.find((row) => !used.has(row.id) && slot.re.test(haystack(row)));
    if (!candidate) candidate = candidates.find((row) => !used.has(row.id));
    if (!candidate) throw new Error(`No candidate for ${slot.block}/${slot.family}`);
    used.add(candidate.id);
    return { ...slot, row: candidate };
  });
}

async function download(supabase, row, neutralId) {
  if (row.local_pdf_path) {
    const bytes = fs.readFileSync(row.local_pdf_path);
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${neutralId}: not a PDF`);
    const pdfPath = path.join(pdfRoot, `${neutralId}.pdf`);
    fs.writeFileSync(pdfPath, bytes);
    return { pdfPath, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
  }
  if (row.pdf_url) {
    const response = await fetch(row.pdf_url);
    if (!response.ok) throw new Error(`${neutralId}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${neutralId}: not a PDF`);
    const pdfPath = path.join(pdfRoot, `${neutralId}.pdf`);
    fs.writeFileSync(pdfPath, bytes);
    return { pdfPath, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
  }
  const bucket = row.storage_bucket || 'papers';
  const objectPath = row.storage_object_path;
  if (!objectPath) throw new Error(`${neutralId}: missing storage path`);
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) throw new Error(`${neutralId}: ${error?.message ?? 'download failed'}`);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${neutralId}: not a PDF`);
  const pdfPath = path.join(pdfRoot, `${neutralId}.pdf`);
  fs.writeFileSync(pdfPath, bytes);
  return { pdfPath, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
}

async function main() {
  const supabase = null;
  fs.mkdirSync(pdfRoot, { recursive: true });

  const includeDirs = [
    path.join(root, 'Full Text - Data Extraaction', 'data extraction 1st'),
    path.join(root, 'Full Text - Data Extraaction', 'extraction 2 pdfs'),
    path.join(root, 'Full Text - Data Extraaction', 'extraction tree PDFs'),
  ];
  const rawIncludeCandidates = includeDirs.flatMap((dir) => fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => ({
      id: crypto.createHash('sha256').update(path.join(dir, name)).digest('hex'),
      assigned_study_id: null,
      title: name.replace(/\.pdf$/i, ''),
      lead_author: null,
      year: name.match(/(?:19|20)\d{2}/)?.[0] ?? null,
      local_pdf_path: path.join(dir, name),
    })));
  rawIncludeCandidates.push({
    id: 'translated-covidence-716',
    assigned_study_id: null,
    title: "Kutnjak 2021 Injury analysis in Slovenian women's football - translated full text",
    lead_author: 'Kutnjak',
    year: '2021',
    local_pdf_path: path.join(root, 'outputs', 'extraction-ready-translations', '2026-05-25-716-869', 'pdfs', 'extraction-ready-#716.pdf'),
  });
  const uniqueIncludes = new Map();
  for (const row of rawIncludeCandidates) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(row.local_pdf_path)).digest('hex');
    const titleKey = row.title.toLowerCase().replace(/-1$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const key = `${hash}:${titleKey}`;
    if (![...uniqueIncludes.values()].some((existing) => existing.title.toLowerCase().replace(/-1$/, '').replace(/[^a-z0-9]+/g, ' ').trim() === titleKey)) {
      uniqueIncludes.set(key, row);
    }
  }
  const includeCandidates = [...uniqueIncludes.values()];

  const sealedExcluded = JSON.parse(fs.readFileSync(path.join(outRoot, 'covidence-excluded-sealed-source.json'), 'utf8'));
  const excludeCandidates = sealedExcluded.filter((row) => row.pdfUrl).map((row) => ({
    id: `covidence-${row.covidenceNumber}`,
    assigned_study_id: null,
    title: row.title,
    lead_author: null,
    year: row.topLine?.match(/(?:19|20)\d{2}/)?.[0] ?? null,
    sealed_reason: row.reason,
    pdf_url: row.pdfUrl,
  }));

  const pickedIncludes = pickSlots(includeSlots, includeCandidates, (row) => row.title ?? '');
  const pickedExcludes = pickSlots(excludeSlots, excludeCandidates, (row) => `${row.title ?? ''} ${historicalReason(row)}`);
  const combined = [...pickedIncludes.map((x) => ({ ...x, label: 'include' })), ...pickedExcludes.map((x) => ({ ...x, label: 'exclude' }))];

  const packet = [];
  const labels = { calibration: [], holdout: [] };
  for (const block of ['calibration', 'holdout']) {
    const rows = combined.filter((x) => x.block === block);
    rows.sort((a, b) => crypto.createHash('sha256').update(`${a.row.id}:2026-06-19`).digest('hex').localeCompare(
      crypto.createHash('sha256').update(`${b.row.id}:2026-06-19`).digest('hex'),
    ));
    for (let i = 0; i < rows.length; i += 1) {
      const item = rows[i];
      const neutralId = `${block === 'calibration' ? 'C' : 'H'}${String(i + 1).padStart(2, '0')}`;
      const file = await download(supabase, item.row, neutralId);
      packet.push({
        neutralId,
        block,
        coverageFamily: item.family,
        title: item.row.title,
        authors: item.row.lead_author,
        year: item.row.year,
        pdfPath: file.pdfPath,
        pdfSha256: file.sha256,
        pdfSize: file.size,
      });
      labels[block].push({
        neutralId,
        historicalDecision: item.label,
        historicalReason: item.label === 'exclude' ? historicalReason(item.row) : null,
        sourceRecordId: item.row.id,
        studyId: item.row.assigned_study_id,
      });
    }
  }

  fs.writeFileSync(path.join(outRoot, 'blinded-manifest.json'), JSON.stringify(packet, null, 2));
  fs.writeFileSync(path.join(outRoot, 'sealed-calibration-labels.json'), JSON.stringify(labels.calibration, null, 2));
  fs.writeFileSync(path.join(outRoot, 'sealed-holdout-labels.json'), JSON.stringify(labels.holdout, null, 2));
  console.log(`prepared=${packet.length}`);
  console.log(`calibration=${packet.filter((x) => x.block === 'calibration').length}`);
  console.log(`holdout=${packet.filter((x) => x.block === 'holdout').length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
