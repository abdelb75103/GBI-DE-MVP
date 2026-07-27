import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_OUTPUT = path.join(
  APP_ROOT,
  'data',
  'source-family-overlap-audit',
  '2026-07-27',
  'complete-candidate-inventory-2026-07-27.json',
);
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const OUTPUT_PATH = outputArgument
  ? path.resolve(APP_ROOT, outputArgument.slice('--output='.length))
  : DEFAULT_OUTPUT;

for (const line of fs.readFileSync(path.join(APP_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

const KEY_FIELD_IDS = new Set([
  'studyId',
  'leadAuthor',
  'title',
  'yearOfPublication',
  'doi',
  'country',
  'fifaDiscipline',
  'levelOfPlay',
  'ageCategory',
  'sex',
  'sampleSizePlayers',
  'numberOfTeams',
  'observationDuration',
  'seasonLength',
  'numberOfSeasons',
  'exposureMeasurementUnit',
  'totalExposure',
  'matchExposure',
  'trainingExposure',
  'injuryTotalCount',
  'injuryIncidenceOverall',
  'injuryIncidenceMatch',
  'injuryIncidenceTraining',
  'injuryTimeLossTotal',
  'illnessTotalCount',
]);

const DENOMINATOR_FIELDS = [
  'observationDuration',
  'seasonLength',
  'numberOfSeasons',
  'sampleSizePlayers',
  'numberOfTeams',
  'totalExposure',
  'matchExposure',
  'trainingExposure',
  'injuryTotalCount',
  'injuryTimeLossTotal',
  'illnessTotalCount',
];

const FAMILY_TERMS = [
  'uefa',
  'ecis',
  'wecis',
  'elite club injury study',
  'champions league',
  'aspetar',
  'asprev',
  'aspire',
  'qatar stars league',
  'qatar',
  'fifa',
  'world cup',
  'olympic football',
  'confederations cup',
  'copa america',
  'premier league',
  'major league soccer',
  'mls',
  'ncaa',
  'high school rio',
  'a-league',
  'national football league',
  'professional football research group',
  'football research group',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normaliseText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|a|an|of|and|in|on|for|to|with|among|from|by)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTitle(value) {
  return String(value ?? '')
    .replace(/^title:\s*/i, '')
    .replace(/^.*?\s+-\s+(?:19|20)\d{2}\s+-\s+/u, '')
    .replace(/(?:-1)?\.pdf$/i, '')
    .trim();
}

function titleTokens(value) {
  return new Set(
    normaliseText(value)
      .split(' ')
      .filter((token) => token.length >= 4),
  );
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((value) => right.has(value)).length;
  return intersection / (left.size + right.size - intersection);
}

function splitValues(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((entry) => normaliseText(entry))
    .filter(Boolean);
}

function meaningfulNumeric(value, minimum) {
  const numeric = Number(String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(numeric) && Math.abs(numeric) >= minimum;
}

function hasSharedExactValue(leftValue, rightValue, minimum = 0) {
  const left = new Set(splitValues(leftValue));
  const right = splitValues(rightValue);
  return right.some((value) =>
    left.has(value)
    && (minimum === 0 || meaningfulNumeric(value, minimum))
  );
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadAllPapers() {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('papers')
      .select('id,assigned_study_id,title,extracted_title,lead_author,journal,year,doi,normalized_doi,duplicate_key_v2,title_fingerprint,dedupe_review_status,status,assigned_to,flag_reason,primary_file_id,primary_file_sha256,original_file_name,metadata,uploaded_at,updated_at')
      .order('assigned_study_id')
      .range(start, start + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

async function loadExtractions(paperIds) {
  const rows = [];
  for (const batch of chunks(paperIds, 50)) {
    const { data, error } = await supabase
      .from('extractions')
      .select('id,paper_id,tab,extraction_fields(field_id,value,status,metric,updated_at)')
      .in('paper_id', batch)
      .order('paper_id')
      .order('tab');
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function loadPopulationGroups(paperIds) {
  const rows = [];
  for (const batch of chunks(paperIds, 50)) {
    const { data, error } = await supabase
      .from('population_groups')
      .select('id,paper_id,label,position,population_values(field_id,value)')
      .in('paper_id', batch)
      .order('paper_id')
      .order('position');
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function loadNotes(paperIds) {
  const rows = [];
  for (const batch of chunks(paperIds, 100)) {
    const { data, error } = await supabase
      .from('paper_notes')
      .select('id,paper_id,body,created_at')
      .in('paper_id', batch)
      .order('paper_id')
      .order('created_at');
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

function compactTreatment(metadata) {
  const treatment = metadata?.analysisSourceTreatment;
  if (!treatment || typeof treatment !== 'object' || Array.isArray(treatment)) return null;
  return treatment;
}

function buildCorpus(papers, extractions, groups, notes) {
  const extractionByPaper = new Map();
  for (const extraction of extractions) {
    const values = extractionByPaper.get(extraction.paper_id) ?? new Map();
    for (const field of extraction.extraction_fields ?? []) {
      if (!KEY_FIELD_IDS.has(field.field_id)) continue;
      const current = values.get(field.field_id);
      if (current && current !== field.value) {
        values.set(field.field_id, [current, field.value].filter(Boolean).join('\n'));
      } else {
        values.set(field.field_id, field.value);
      }
    }
    extractionByPaper.set(extraction.paper_id, values);
  }

  const groupsByPaper = new Map();
  for (const group of groups) {
    const paperGroups = groupsByPaper.get(group.paper_id) ?? [];
    const allValues = (group.population_values ?? [])
      .filter((value) => value.value != null && String(value.value).trim())
      .map((value) => [value.field_id, value.value]);
    paperGroups.push({
      label: group.label,
      position: group.position,
      values: Object.fromEntries(
        allValues.filter(([fieldId]) => KEY_FIELD_IDS.has(fieldId)),
      ),
      stableValues: Object.fromEntries(allValues.slice(0, 4)),
    });
    groupsByPaper.set(group.paper_id, paperGroups);
  }

  const notesByPaper = new Map();
  for (const note of notes) {
    const paperNotes = notesByPaper.get(note.paper_id) ?? [];
    paperNotes.push({
      id: note.id,
      createdAt: note.created_at,
      body: note.body,
    });
    notesByPaper.set(note.paper_id, paperNotes);
  }

  return papers.map((paper) => {
    const fields = Object.fromEntries(extractionByPaper.get(paper.id) ?? []);
    const populationGroups = groupsByPaper.get(paper.id) ?? [];
    const paperNotes = notesByPaper.get(paper.id) ?? [];
    const searchableText = [
      paper.assigned_study_id,
      paper.title,
      paper.extracted_title,
      paper.lead_author,
      paper.journal,
      paper.original_file_name,
      ...Object.values(fields),
      ...populationGroups.map((group) => group.label),
      ...paperNotes.map((note) => note.body),
    ].filter(Boolean).join(' ');
    const familyTerms = FAMILY_TERMS.filter((term) =>
      normaliseText(searchableText).includes(normaliseText(term))
    );
    return {
      id: paper.id,
      studyId: paper.assigned_study_id,
      title: paper.title,
      extractedTitle: paper.extracted_title,
      leadAuthor: paper.lead_author,
      journal: paper.journal,
      year: paper.year,
      doi: paper.doi,
      normalizedDoi: paper.normalized_doi,
      duplicateKeyV2: paper.duplicate_key_v2,
      titleFingerprint: paper.title_fingerprint,
      dedupeReviewStatus: paper.dedupe_review_status,
      status: paper.status,
      assignedTo: paper.assigned_to,
      flagReason: paper.flag_reason,
      primaryFileSha256: paper.primary_file_sha256,
      fields,
      populationGroups,
      notes: paperNotes,
      analysisSourceTreatment: compactTreatment(paper.metadata),
      familyTerms,
    };
  });
}

function treatmentLinks(record) {
  const links = record.analysisSourceTreatment?.sourceLinks;
  return Array.isArray(links) ? links : [];
}

function referencesStudy(record, studyId) {
  const pattern = new RegExp(`\\b${studyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return record.notes.some((note) => pattern.test(note.body))
    || record.populationGroups.some((group) => pattern.test(group.label));
}

function scorePair(left, right) {
  const reasons = [];
  let score = 0;

  if (left.normalizedDoi && left.normalizedDoi === right.normalizedDoi) {
    score += 120;
    reasons.push({ kind: 'exact_doi', weight: 120, value: left.normalizedDoi });
  }
  if (left.primaryFileSha256 && left.primaryFileSha256 === right.primaryFileSha256) {
    score += 120;
    reasons.push({ kind: 'exact_file_sha256', weight: 120, value: left.primaryFileSha256 });
  }
  if (left.duplicateKeyV2 && left.duplicateKeyV2 === right.duplicateKeyV2) {
    score += 90;
    reasons.push({ kind: 'exact_duplicate_key', weight: 90, value: left.duplicateKeyV2 });
  }
  if (left.titleFingerprint && left.titleFingerprint === right.titleFingerprint) {
    score += 80;
    reasons.push({ kind: 'exact_title_fingerprint', weight: 80, value: left.titleFingerprint });
  }

  const normalisedLeftTitle = normaliseText(canonicalTitle(left.extractedTitle || left.title));
  const normalisedRightTitle = normaliseText(canonicalTitle(right.extractedTitle || right.title));
  if (normalisedLeftTitle && normalisedLeftTitle === normalisedRightTitle) {
    score += 80;
    reasons.push({ kind: 'exact_normalised_title', weight: 80, value: normalisedLeftTitle });
  } else {
    const shorterTitle = normalisedLeftTitle.length <= normalisedRightTitle.length
      ? normalisedLeftTitle
      : normalisedRightTitle;
    const longerTitle = normalisedLeftTitle.length > normalisedRightTitle.length
      ? normalisedLeftTitle
      : normalisedRightTitle;
    if (shorterTitle.length >= 32 && longerTitle.includes(shorterTitle)) {
      score += 65;
      reasons.push({ kind: 'title_containment', weight: 65, value: shorterTitle });
    }
    const titleSimilarity = jaccard(
      titleTokens(canonicalTitle(left.extractedTitle || left.title)),
      titleTokens(canonicalTitle(right.extractedTitle || right.title)),
    );
    if (titleSimilarity >= 0.5) {
      const weight = Math.round(titleSimilarity * 20);
      score += weight;
      reasons.push({
        kind: 'near_title',
        weight,
        value: Number(titleSimilarity.toFixed(3)),
      });
    }
  }

  const fieldWeights = {
    observationDuration: [22, 0],
    seasonLength: [8, 0],
    numberOfSeasons: [6, 2],
    sampleSizePlayers: [10, 20],
    numberOfTeams: [8, 2],
    totalExposure: [28, 100],
    matchExposure: [22, 100],
    trainingExposure: [22, 100],
    injuryTotalCount: [16, 20],
    injuryTimeLossTotal: [14, 20],
    illnessTotalCount: [10, 10],
  };
  for (const fieldId of DENOMINATOR_FIELDS) {
    const [weight, minimum] = fieldWeights[fieldId];
    if (hasSharedExactValue(left.fields[fieldId], right.fields[fieldId], minimum)) {
      score += weight;
      reasons.push({
        kind: 'shared_exact_field_value',
        fieldId,
        weight,
        left: left.fields[fieldId],
        right: right.fields[fieldId],
      });
    }
  }

  if (left.year && left.year === right.year) {
    score += 2;
    reasons.push({ kind: 'same_publication_year', weight: 2, value: left.year });
  }

  const sharedTerms = left.familyTerms.filter((term) => right.familyTerms.includes(term));
  if (sharedTerms.length > 0) {
    const weight = Math.min(12, 3 + sharedTerms.length * 2);
    score += weight;
    reasons.push({ kind: 'shared_family_terms', weight, value: sharedTerms });
  }

  const explicitLink = treatmentLinks(left).some((link) => link.anchorStudyId === right.studyId)
    || treatmentLinks(right).some((link) => link.anchorStudyId === left.studyId);
  if (explicitLink) {
    score += 150;
    reasons.push({ kind: 'existing_analysis_source_link', weight: 150 });
  }

  if (referencesStudy(left, right.studyId) || referencesStudy(right, left.studyId)) {
    score += 80;
    reasons.push({ kind: 'note_or_master_row_cross_reference', weight: 80 });
  }

  const strongIdentity = reasons.some((reason) =>
    ['exact_doi', 'exact_file_sha256', 'exact_duplicate_key', 'exact_title_fingerprint'].includes(reason.kind)
  );
  const bibliographicDuplicate = reasons.some((reason) =>
    ['exact_normalised_title', 'title_containment'].includes(reason.kind)
  );
  const exactDenominators = reasons.filter((reason) => reason.kind === 'shared_exact_field_value');
  const evidenceClass = strongIdentity
    ? 'identity-level candidate'
    : bibliographicDuplicate
      ? 'bibliographic duplicate candidate'
    : exactDenominators.length >= 3
      ? 'strong cohort-overlap candidate'
      : exactDenominators.length >= 1 && score >= 35
        ? 'moderate cohort-overlap candidate'
        : 'weak similarity candidate';

  return { score, evidenceClass, reasons };
}

function connectedComponents(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.leftStudyId)?.add(edge.rightStudyId);
    adjacency.get(edge.rightStudyId)?.add(edge.leftStudyId);
  }
  const seen = new Set();
  const components = [];
  for (const node of nodes) {
    if (seen.has(node) || adjacency.get(node)?.size === 0) continue;
    const stack = [node];
    const component = [];
    seen.add(node);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const neighbour of adjacency.get(current) ?? []) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        stack.push(neighbour);
      }
    }
    components.push(component.sort());
  }
  return components.sort((left, right) => right.length - left.length);
}

const papers = await loadAllPapers();
assert(papers.length > 0, 'No live papers were returned');
const paperIds = papers.map((paper) => paper.id);
const [extractions, groups, notes] = await Promise.all([
  loadExtractions(paperIds),
  loadPopulationGroups(paperIds),
  loadNotes(paperIds),
]);
const corpus = buildCorpus(papers, extractions, groups, notes);
const candidates = [];
for (let leftIndex = 0; leftIndex < corpus.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < corpus.length; rightIndex += 1) {
    const left = corpus[leftIndex];
    const right = corpus[rightIndex];
    const result = scorePair(left, right);
    if (result.score < 18) continue;
    candidates.push({
      leftStudyId: left.studyId,
      rightStudyId: right.studyId,
      leftTitle: left.title,
      rightTitle: right.title,
      ...result,
    });
  }
}
candidates.sort((left, right) =>
  right.score - left.score
  || left.leftStudyId.localeCompare(right.leftStudyId)
  || left.rightStudyId.localeCompare(right.rightStudyId)
);

const familyEdges = candidates.filter((candidate) =>
  candidate.evidenceClass !== 'weak similarity candidate'
  || candidate.reasons.some((reason) =>
    ['existing_analysis_source_link', 'note_or_master_row_cross_reference'].includes(reason.kind)
  )
);
const artifact = {
  artifactType: 'Complete live source-family overlap candidate inventory',
  generatedAt: new Date().toISOString(),
  methodology: {
    scope: 'All rows in the live papers table, with live extraction fields, population rows, notes, and existing analysis source-treatment metadata.',
    interpretation: 'Candidates are evidence-gathering prompts, not cohort-equivalence decisions. Title, author, affiliation, or keyword similarity alone never proves shared data.',
    candidateThreshold: 18,
    familyGraphRule: 'Identity-level, moderate/strong cohort-overlap, or explicit live cross-reference candidates only.',
    fieldIds: [...KEY_FIELD_IDS],
  },
  counts: {
    papers: corpus.length,
    extractions: extractions.length,
    populationGroups: groups.length,
    notes: notes.length,
    candidates: candidates.length,
    identityLevelCandidates: candidates.filter((candidate) => candidate.evidenceClass === 'identity-level candidate').length,
    bibliographicDuplicateCandidates: candidates.filter((candidate) => candidate.evidenceClass === 'bibliographic duplicate candidate').length,
    strongCohortCandidates: candidates.filter((candidate) => candidate.evidenceClass === 'strong cohort-overlap candidate').length,
    moderateCohortCandidates: candidates.filter((candidate) => candidate.evidenceClass === 'moderate cohort-overlap candidate').length,
    weakSimilarityCandidates: candidates.filter((candidate) => candidate.evidenceClass === 'weak similarity candidate').length,
  },
  corpusHash: stableHash(corpus),
  candidateHash: stableHash(candidates),
  familyComponents: connectedComponents(
    corpus.map((record) => record.studyId),
    familyEdges,
  ),
  candidates,
  papers: corpus,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath: OUTPUT_PATH,
  counts: artifact.counts,
  corpusHash: artifact.corpusHash,
  candidateHash: artifact.candidateHash,
  familyComponentCount: artifact.familyComponents.length,
}, null, 2));
