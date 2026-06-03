import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';

import {
  assignSplit,
  buildMetrics,
  buildPrompt,
  buildReportMarkdown,
  createBlindRecord,
  DEFAULT_PROVIDER,
  expandCompactRecommendation,
  preTriageRecord,
  selectDeterministicSample,
  parseRayyanCsv,
  resolveProvider,
  validateModelOutput,
} from '../../skills/fifa-title-abstract-screening-review/scripts/validate_first_batch_rayyan_ai.mjs';

const sampleCsv = `key,title,year,journal,abstract,doi,keywords,Screening Decision 
rayyan-1,"Football injuries in academy players",2024,"Sports Medicine","We report injury incidence in soccer academy players.","10.1/example","soccer; injury","Included at least 2 reveiwers unanimous"
rayyan-2,"Hamstring injuries in soccer: a systematic review",2021,"BJSM","This systematic review examines hamstring injuries in soccer.","10.2/example","football","Maybe Resolver (full text screening needed)"
`;

const refereeCsv = `key,title,year,journal,abstract,doi,keywords,Screening Decision 
rayyan-ref,"Prevalence and burden of health problems in top-level football referees",2023,"BJSM","This prospective study reports health problem prevalence and burden in top-level football referees.","10.3/example","football; referees; burden","Conflict Included (Resolver Decision)"
`;

test('parseRayyanCsv preserves human decisions for audit but createBlindRecord hides them from model input', () => {
  const rows = parseRayyanCsv(sampleCsv);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].humanDecision, 'Included at least 2 reveiwers unanimous');
  assert.equal(rows[0].title, 'Football injuries in academy players');

  const blind = createBlindRecord(rows[0]);

  assert.equal(blind.recordId, 'rayyan-1');
  assert.equal(blind.title, 'Football injuries in academy players');
  assert.equal(Object.hasOwn(blind, 'humanDecision'), false);
  assert.equal(Object.hasOwn(blind, 'Screening Decision '), false);
});

test('assignSplit is deterministic and uses the requested split ratio', () => {
  const keys = Array.from({ length: 50 }, (_, index) => `rayyan-${index + 1}`);
  const first = keys.map((key) => assignSplit(key, 0.8));
  const second = keys.map((key) => assignSplit(key, 0.8));

  assert.deepEqual(first, second);
  assert.equal(first.filter((split) => split === 'calibration').length, 40);
  assert.equal(first.filter((split) => split === 'holdout').length, 10);
});

test('selectDeterministicSample takes a stable distributed sample rather than the first rows', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({
    key: `rayyan-${index + 1}`,
    rowNumber: index + 2,
  }));

  const sample = selectDeterministicSample(rows, 0.1);
  const repeat = selectDeterministicSample(rows, 0.1);

  assert.deepEqual(sample, repeat);
  assert.equal(sample.length, 10);
  assert.notDeepEqual(sample.map((row) => row.key), rows.slice(0, 10).map((row) => row.key));
  assert.equal(sample.every((row) => rows.includes(row)), true);
});

test('selectDeterministicSample can take a second non-overlapping sample window', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({
    key: `rayyan-${index + 1}`,
    rowNumber: index + 2,
  }));

  const first = selectDeterministicSample(rows, 0.1, 0);
  const second = selectDeterministicSample(rows, 0.1, 1);
  const firstKeys = new Set(first.map((row) => row.key));

  assert.equal(first.length, 10);
  assert.equal(second.length, 10);
  assert.equal(second.some((row) => firstKeys.has(row.key)), false);
});

test('buildMetrics treats include and undecided as known-positive matches and excludes as false negatives', () => {
  const rows = parseRayyanCsv(sampleCsv);
  const predictions = new Map([
    ['rayyan-1', { recordId: 'rayyan-1', decision: 'include', reason: 'Relevant.', confidence: 0.8 }],
    ['rayyan-2', { recordId: 'rayyan-2', decision: 'exclude', reason: 'Review.', confidence: 0.7 }],
  ]);

  const metrics = buildMetrics(rows, predictions);

  assert.equal(metrics.total, 2);
  assert.equal(metrics.matches, 1);
  assert.equal(metrics.falseExcludes, 1);
  assert.equal(metrics.knownPositiveSafety, 0.5);
  assert.equal(metrics.falseExclusionRate, 0.5);
  assert.deepEqual(metrics.modelDecisionCounts, { include: 1, exclude: 1, undecided: 0, missing: 0 });
});

test('referee surveillance records are represented as known-positive validation rows', () => {
  const rows = parseRayyanCsv(refereeCsv);
  const blind = createBlindRecord(rows[0]);
  const predictions = new Map([
    ['rayyan-ref', {
      recordId: 'rayyan-ref',
      decision: 'include',
      reason: 'Football referee health-problem burden surveillance.',
      confidence: 0.88,
      targetTag: 'referee',
    }],
  ]);

  const metrics = buildMetrics(rows, predictions);

  assert.match(blind.title, /football referees/);
  assert.equal(metrics.knownPositiveSafety, 1);
  assert.equal(metrics.falseExcludes, 0);
});

test('runtime criteria explicitly preserves referee inclusion, RTP exclusion, and mental-health caveats', () => {
  const criteriaPath = path.resolve(
    import.meta.dirname,
    '../../skills/fifa-title-abstract-screening-review/references/runtime-criteria.md',
  );
  const criteria = readFileSync(criteriaPath, 'utf8');

  assert.match(criteria, /referees/i);
  assert.match(criteria, /match officials/i);
  assert.match(criteria, /tag `referee`/i);
  assert.match(criteria, /Pure return-to-play/i);
  assert.match(criteria, /incidence, prevalence, burden, counts, rates/i);
  assert.match(criteria, /Do not apply full-text denominator exclusions too early/i);
  assert.match(criteria, /mixed-sport records/i);
  assert.match(criteria, /Mental-health and psychological-health records/i);
  assert.match(criteria, /already-injured football\/soccer players/i);
  assert.match(criteria, /attitude, knowledge, belief, awareness, perception/i);
  assert.match(criteria, /Missing abstracts are not automatic `undecided`/i);
});

test('provider defaults to local codex-cli and rejects API routing', () => {
  assert.equal(DEFAULT_PROVIDER, 'codex-cli');
  assert.equal(resolveProvider(undefined), 'codex-cli');
  assert.equal(resolveProvider('codex-cli'), 'codex-cli');
  assert.throws(() => resolveProvider('auto'), /codex-cli/);
  assert.throws(() => resolveProvider('openai-responses'), /codex-cli/);
});

test('buildPrompt uses compact runtime criteria and compact JSON output', () => {
  const rows = parseRayyanCsv(sampleCsv);
  const prompt = buildPrompt({
    rows,
    criteriaText: 'Runtime criteria card: include referees; exclude pure return-to-play.',
    criteriaVersion: 'test-v1',
    abstractChars: 600,
    previousFailure: 'missing id',
  });

  assert.match(prompt, /Runtime criteria card/);
  assert.match(prompt, /\{"id":"record-id","d":"include\|exclude\|undecided","r":"reason_code"/);
  assert.doesNotMatch(prompt, /"recommendations"/);
  assert.match(prompt, /Previous output failed validation/);
});

test('preTriageRecord handles obvious include, referee include, RTP exclude, wrong sport exclude, and thin undecided', () => {
  const include = preTriageRecord({
    key: 'soccer-incidence',
    title: 'Injury incidence in elite soccer players',
    abstract: 'A prospective surveillance study reports injury counts, incidence rates, and exposure hours.',
  }, 'test model');
  assert.equal(include?.decision, 'include');
  assert.match(include.reason, /surveillance/i);

  const referee = preTriageRecord({
    key: 'referee-burden',
    title: 'Prevalence and burden of health problems in football referees',
    abstract: 'This prospective study reports health problem prevalence and burden in top-level football referees.',
  }, 'test model');
  assert.equal(referee?.decision, 'include');
  assert.equal(referee.targetTag, 'referee');
  assert.equal(referee.tags.includes('referee'), true);

  const rtp = preTriageRecord({
    key: 'rtp-only',
    title: 'Return to play after hamstring injury in soccer',
    abstract: 'This paper describes rehabilitation and return to sport after hamstring injury.',
  }, 'test model');
  assert.equal(rtp?.decision, 'exclude');
  assert.match(rtp.exclusionReason, /return-to-play/i);

  const wrongSport = preTriageRecord({
    key: 'nfl',
    title: 'Concussion incidence in National Football League players',
    abstract: 'The study evaluates NFL American football athletes.',
  }, 'test model');
  assert.equal(wrongSport?.decision, 'exclude');
  assert.match(wrongSport.exclusionReason, /wrong sport/i);

  const thin = preTriageRecord({
    key: 'thin',
    title: 'Football injuries',
    abstract: '',
  }, 'test model');
  assert.equal(thin?.decision, 'undecided');
});

test('preTriageRecord excludes already-injured functional outcomes and attitude-only surveys', () => {
  const postInjury = preTriageRecord({
    key: 'post-injury',
    title: 'Functional outcomes in previously injured soccer players',
    abstract: 'A cross-sectional study of injured footballers reports post-injury function and symptoms after rehabilitation.',
  }, 'test model');

  assert.equal(postInjury?.decision, 'exclude');
  assert.match(postInjury.exclusionReason, /Already-injured/i);

  const attitudeSurvey = preTriageRecord({
    key: 'attitude-survey',
    title: 'Attitudes toward mental health support among professional footballers',
    abstract: 'This questionnaire survey examines beliefs, awareness, and perceptions about mental health services.',
  }, 'test model');

  assert.equal(attitudeSurvey?.decision, 'exclude');
  assert.match(attitudeSurvey.exclusionReason, /Attitude/i);
});

test('preTriageRecord excludes post-ACLR return-to-play cohorts without surveillance data', () => {
  const aclReturnToPlay = preTriageRecord({
    key: 'post-aclr-rtp',
    title: 'Early versus standard return to play following ACL reconstruction in professional European soccer players: a retrospective cohort study',
    abstract: 'A total of 180 male professional European soccer players underwent ACLR and were compared on time from intervention to RTP, games, minutes played, seasons played after surgery, playing status, and graft failures.',
  }, 'test model');

  assert.equal(aclReturnToPlay?.decision, 'exclude');
  assert.match(aclReturnToPlay.exclusionReason, /Already-injured/i);
});

test('preTriageRecord excludes retrospective video event-characteristic records without exposure surveillance', () => {
  const videoHeadInjurySituations = preTriageRecord({
    key: 'video-phis',
    title: 'Characteristics of potential head injury situations at the FIFA World Cup Qatar 2022',
    abstract: 'This exploratory video analysis study used match footage from 64 matches to record potential head injury situations, medical assessment, outcome, and aerial duels. Descriptive statistics reported 149 potential head injury situations and mean events per match.',
  }, 'test model');

  assert.equal(videoHeadInjurySituations?.decision, 'exclude');
  assert.match(videoHeadInjurySituations.exclusionReason, /video|match-footage/i);
});

test('preTriageRecord excludes title-only player reflection records without surveillance signal', () => {
  const playerReflections = preTriageRecord({
    key: 'player-reflections',
    title: 'Player reflections on change: 20 years of evolving demands and support in elite football',
    abstract: '',
    keywords: 'Athletes | Athletic Injuries | Athletic Performance | Sport | Sports medicine',
  }, 'test model');

  assert.equal(playerReflections?.decision, 'exclude');
  assert.match(playerReflections.exclusionReason, /Qualitative reflection/i);
});

test('preTriageRecord keeps sparse football mental-health and injury-anxiety records for full text', () => {
  const mentalHealthTrial = preTriageRecord({
    key: 'injury-anxiety',
    title: 'Effect of camp period loading on sports injury anxiety, physical performance, and professional male soccer players',
    abstract: 'Clinical trial registry entry describing outcomes in professional male soccer players.',
  }, 'test model');

  assert.equal(mentalHealthTrial?.decision, 'include');
  assert.match(mentalHealthTrial.reason, /mental-health|injury-anxiety/i);
  assert.equal(mentalHealthTrial.tags.includes('mental_health'), true);
});

test('preTriageRecord can make decisive title-only decisions when abstract is missing', () => {
  const wrongSportTitleOnly = preTriageRecord({
    key: 'american-football-title-only',
    title: 'Concussion incidence in National Football League players',
    abstract: '',
  }, 'test model');

  assert.equal(wrongSportTitleOnly?.decision, 'exclude');
  assert.match(wrongSportTitleOnly.exclusionReason, /wrong sport/i);

  const clearSoccerSurveillanceTitleOnly = preTriageRecord({
    key: 'soccer-surveillance-title-only',
    title: 'Injury incidence and burden in elite soccer players',
    abstract: '',
  }, 'test model');

  assert.equal(clearSoccerSurveillanceTitleOnly?.decision, 'include');
  assert.match(clearSoccerSurveillanceTitleOnly.reason, /surveillance/i);

  const vagueSoccerTitleOnly = preTriageRecord({
    key: 'vague-soccer-title-only',
    title: 'Football injuries',
    abstract: '',
  }, 'test model');

  assert.equal(vagueSoccerTitleOnly?.decision, 'undecided');
  assert.equal(vagueSoccerTitleOnly.tags.includes('missing_abstract'), true);
});

test('compact model output is expanded into audit-friendly recommendations', () => {
  const rows = parseRayyanCsv(sampleCsv);
  const normalized = validateModelOutput(rows, [
    { id: 'rayyan-1', d: 'include', r: 'soccer_injury_surveillance', c: 0.82, t: ['player'] },
    { id: 'rayyan-2', d: 'exclude', r: 'review_not_primary_extraction', c: 0.76, q: 'Hamstring injuries in soccer: a systematic review', l: 'Title' },
  ], 'test model');

  assert.equal(normalized[0].decision, 'include');
  assert.match(normalized[0].reason, /surveillance/i);
  assert.equal(normalized[0].confidence, 0.82);
  assert.equal(normalized[1].decision, 'exclude');
  assert.match(normalized[1].exclusionReason, /review/i);

  const expanded = expandCompactRecommendation({ id: 'x', d: 'undecided', r: 'missing_abstract', c: 0.2 });
  assert.equal(expanded.recordId, 'x');
  assert.equal(expanded.decision, 'undecided');
  assert.equal(expanded.reason, 'Missing or too-thin abstract; cannot safely exclude from title/citation alone.');
});

test('buildReportMarkdown records model, criteria, split metrics, and audit paths', () => {
  const metrics = {
    all: {
      total: 2,
      matches: 1,
      falseExcludes: 1,
      knownPositiveSafety: 0.5,
      falseExclusionRate: 0.5,
      modelDecisionCounts: { include: 1, exclude: 1, undecided: 0, missing: 0 },
      byHumanDecision: {},
    },
    calibration: {
      total: 1,
      matches: 1,
      falseExcludes: 0,
      knownPositiveSafety: 1,
      falseExclusionRate: 0,
      modelDecisionCounts: { include: 1, exclude: 0, undecided: 0, missing: 0 },
      byHumanDecision: {},
    },
    holdout: {
      total: 1,
      matches: 0,
      falseExcludes: 1,
      knownPositiveSafety: 0,
      falseExclusionRate: 1,
      modelDecisionCounts: { include: 0, exclude: 1, undecided: 0, missing: 0 },
      byHumanDecision: {},
    },
  };

  const report = buildReportMarkdown({
    phase: 'baseline',
    model: 'gpt-5.5',
    reasoning: 'medium',
    provider: 'codex-cli',
    criteriaVersion: 'fifa-gbi-title-abstract-v1-2026-05-27',
    sourceCsv: '/tmp/articles.csv',
    generatedAt: '2026-06-02T12:00:00.000Z',
    metrics,
    auditFiles: {
      predictions: '/tmp/predictions.json',
      comparison: '/tmp/comparison.csv',
      errors: '/tmp/false-excludes.csv',
    },
  });

  assert.match(report, /First-Batch Rayyan Title\/Abstract AI Validation/);
  assert.match(report, /Known-positive safety/);
  assert.match(report, /gpt-5\.5/);
  assert.match(report, /\/tmp\/comparison\.csv/);
});
