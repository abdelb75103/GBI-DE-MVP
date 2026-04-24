#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { TOPIC_REGISTRY } from './kb-topics.mjs';

const DEFAULT_VAULT_PATH = path.join(os.homedir(), 'Desktop', 'Obsidian Vault', 'FIFA GBI Knowledge Vault');
const MANIFEST_FILE = '.gbi-kb-manifest.json';
const RESULT_PATTERNS = [
  'incidence',
  'rate',
  'rates',
  'prevalence',
  'burden',
  'risk',
  'odds',
  'hazard',
  'time-loss',
  'time loss',
  'days lost',
  '/1000',
  'per 1000',
  'per season',
  '%',
];
const POPULATION_PATTERNS = [
  'women',
  'female',
  'male',
  'youth',
  'elite',
  'professional',
  'adolescent',
  'amateur',
  'league',
  'players',
  'referees',
];
const SOURCE_WEIGHTS = {
  'query-card': 4,
  citation: 3,
  extractions: 4,
  notes: 2,
  figures: 2,
  fulltext: 1,
};
function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rmrf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function normalizePlainText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r/g, '')
    .replace(/[^\p{L}\p{N}%/.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function readOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function getField(markdown, label) {
  return markdown.match(new RegExp(`^- ${label}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';
}

function splitSegments(text) {
  return text
    .split('\n')
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 20);
}

function includesAlias(normalizedText, alias) {
  return normalizedText.includes(alias);
}

function collectMatchGroups(normalizedText, groups) {
  return groups.every((group) => group.some((alias) => includesAlias(normalizedText, alias)));
}

function collectSourceMatches(text, topic) {
  const normalized = normalizePlainText(text);
  if (!normalized) {
    return { matchedAliases: [], excludedAliases: [], groupSatisfied: topic.matchAllGroups ? false : true };
  }

  const matchedAliases = topic.aliases.filter((alias) => includesAlias(normalized, normalizePlainText(alias)));
  const excludedAliases = (topic.exclusions ?? []).filter((alias) => includesAlias(normalized, normalizePlainText(alias)));
  const groupSatisfied = topic.matchAllGroups ? collectMatchGroups(normalized, topic.matchAllGroups.map((group) => group.map((alias) => normalizePlainText(alias)))) : true;
  return { matchedAliases, excludedAliases, groupSatisfied };
}

function pickRelevantSegments(text, topic, patterns, limit = 3) {
  const topicAliases = topic.aliases.map((alias) => normalizePlainText(alias));
  const normalizedPatterns = patterns.map((pattern) => normalizePlainText(pattern));
  const chosen = [];
  for (const segment of splitSegments(text)) {
    const normalized = normalizePlainText(segment);
    const hasTopic = topicAliases.some((alias) => includesAlias(normalized, alias));
    const hasPattern = normalizedPatterns.some((pattern) => includesAlias(normalized, pattern));
    if ((hasTopic && hasPattern) || (patterns === RESULT_PATTERNS && hasPattern && normalized.includes('/1000'))) {
      chosen.push(segment);
    } else if (patterns !== RESULT_PATTERNS && hasTopic && hasPattern) {
      chosen.push(segment);
    }
    if (chosen.length >= limit) {
      break;
    }
  }
  return chosen;
}

function supportLink(studyId, sourceName) {
  const target = {
    'query-card': 'query-card',
    citation: 'citation',
    extractions: 'extractions',
    notes: 'notes',
    figures: 'figures/index',
    fulltext: 'fulltext',
  }[sourceName];
  return target ? `[[papers/${studyId}/${target}|${sourceName}]]` : null;
}

function parseExistingReviewRows(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('Topic |') && !line.includes('--- |'))
    .map((line) => line.trim());
}

function buildTopicOverview(topic, entries) {
  const quantitativeEntries = entries.filter((entry) => entry.quantitativeSignals.length > 0);
  const figureEntries = entries.filter((entry) => entry.figureLinks.length > 0);
  const lines = [
    `# ${topic.name}`,
    '',
    `- Topic slug: \`${topic.slug}\``,
    `- Included papers: ${entries.length}`,
    `- Papers with quantitative signals: ${quantitativeEntries.length}`,
    `- Papers with figure evidence: ${figureEntries.length}`,
    `- Review queue: [[_syntheses/review/topic-assignment-uncertain|topic-assignment-uncertain]]`,
    '',
    '## Topic Files',
    '',
    '- [[evidence-table]]',
    '- [[claims]]',
    '- [[gaps]]',
    '- [[figures]]',
    '',
    '## Top Quantitative Signals',
    '',
  ];

  if (quantitativeEntries.length === 0) {
    lines.push('No strong incidence/rate/burden signals were extracted for this topic yet.');
  } else {
    for (const entry of quantitativeEntries.slice(0, 10)) {
      lines.push(`- [[papers/${entry.studyId}/index|${entry.studyId}]]: ${entry.quantitativeSignals[0]}`);
    }
  }

  lines.push('', '## Included Papers', '');
  for (const entry of entries) {
    lines.push(`- [[papers/${entry.studyId}/index|${entry.studyId}]] — ${entry.title}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildEvidenceTable(topic, entries) {
  const lines = [
    `# ${topic.name} Evidence Table`,
    '',
    '| Study | Year | Match Basis | Population / Context | Quantitative Signal | Sources |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const entry of entries) {
    const sources = entry.supportLinks.join(', ');
    lines.push(
      `| [[papers/${entry.studyId}/index|${entry.studyId}]] | ${markdownEscape(entry.year || 'Unknown')} | ${markdownEscape(entry.matchBasis)} | ${markdownEscape(entry.populationContext || 'Not captured')} | ${markdownEscape(entry.quantitativeSignals[0] || 'No strong quantitative signal found')} | ${sources} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildClaimsMarkdown(topic, entries) {
  const lines = [`# ${topic.name} Claims`, ''];
  if (entries.length === 0) {
    lines.push('No confident topic matches were generated.');
    return `${lines.join('\n')}\n`;
  }

  for (const entry of entries) {
    lines.push(`## ${entry.studyId}`);
    lines.push('');
    lines.push(`- Conservative claim: [[papers/${entry.studyId}/index|${entry.studyId}]] contains source-grounded evidence relevant to ${topic.name}.`);
    lines.push(`- Match basis: ${entry.matchBasis}`);
    lines.push(`- Supporting sources: ${entry.supportLinks.join(', ')}`);
    if (entry.quantitativeSignals.length > 0) {
      lines.push('- Quantitative/result signals:');
      for (const snippet of entry.quantitativeSignals) {
        lines.push(`  - ${snippet}`);
      }
    }
    if (entry.topicSignals.length > 0) {
      lines.push('- Topic-relevant evidence:');
      for (const snippet of entry.topicSignals) {
        lines.push(`  - ${snippet}`);
      }
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function buildGapsMarkdown(topic, entries, uncertainEntries) {
  const missingQuant = entries.filter((entry) => entry.quantitativeSignals.length === 0);
  const missingExtractions = entries.filter((entry) => !entry.sourceMatches.includes('extractions'));
  const missingFigures = entries.filter((entry) => entry.figureLinks.length === 0);
  const lines = [`# ${topic.name} Gaps`, ''];

  lines.push('## Missing Quantitative Signals', '');
  if (missingQuant.length === 0) {
    lines.push('All confident papers had at least one quantitative/result signal.');
  } else {
    for (const entry of missingQuant) {
      lines.push(`- [[papers/${entry.studyId}/index|${entry.studyId}]]`);
    }
  }

  lines.push('', '## Missing Extraction Coverage', '');
  if (missingExtractions.length === 0) {
    lines.push('All confident papers had extraction-based support for this topic.');
  } else {
    for (const entry of missingExtractions) {
      lines.push(`- [[papers/${entry.studyId}/index|${entry.studyId}]]`);
    }
  }

  lines.push('', '## Missing Figure Evidence', '');
  if (missingFigures.length === 0) {
    lines.push('All confident papers had at least one matching figure reference.');
  } else {
    for (const entry of missingFigures) {
      lines.push(`- [[papers/${entry.studyId}/index|${entry.studyId}]]`);
    }
  }

  lines.push('', '## Uncertain Topic Assignments', '');
  if (uncertainEntries.length === 0) {
    lines.push('No uncertain assignments for this topic.');
  } else {
    for (const entry of uncertainEntries) {
      lines.push(`- [[papers/${entry.studyId}/index|${entry.studyId}]] — ${entry.reason}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildFiguresMarkdown(topic, entries) {
  const lines = [`# ${topic.name} Figures`, ''];
  const withFigures = entries.filter((entry) => entry.figureLinks.length > 0);
  if (withFigures.length === 0) {
    lines.push('No topic-matching figure notes were found.');
    return `${lines.join('\n')}\n`;
  }
  for (const entry of withFigures) {
    lines.push(`## ${entry.studyId}`);
    lines.push('');
    for (const figureLink of entry.figureLinks) {
      lines.push(`- ${figureLink}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function collectFigureFiles(figuresDir) {
  if (!fs.existsSync(figuresDir)) {
    return [];
  }
  return fs.readdirSync(figuresDir)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .sort()
    .map((name) => ({
      name,
      text: readOptional(path.join(figuresDir, name)),
    }));
}

function buildEntryForPaper(vaultRoot, studyId, topic) {
  const paperDir = path.join(vaultRoot, 'papers', studyId);
  const queryCard = readOptional(path.join(paperDir, 'query-card.md'));
  const citation = readOptional(path.join(paperDir, 'citation.md'));
  const extractions = readOptional(path.join(paperDir, 'extractions.md'));
  const notes = readOptional(path.join(paperDir, 'notes.md'));
  const fulltext = readOptional(path.join(paperDir, 'fulltext.md'));
  const figures = collectFigureFiles(path.join(paperDir, 'figures'));

  const sources = [
    { name: 'query-card', text: queryCard },
    { name: 'citation', text: citation },
    { name: 'extractions', text: extractions },
    { name: 'notes', text: notes },
    { name: 'figures', text: figures.map((figure) => figure.text).join('\n\n') },
    { name: 'fulltext', text: fulltext },
  ];

  let score = 0;
  const aliases = new Set();
  const sourceMatches = [];
  const reasons = [];
  let blockedByExclusion = false;

  for (const source of sources) {
    const { matchedAliases, excludedAliases, groupSatisfied } = collectSourceMatches(source.text, topic);
    if (excludedAliases.length > 0 && matchedAliases.length === 0) {
      blockedByExclusion = true;
      continue;
    }
    if (matchedAliases.length === 0) {
      continue;
    }
    if (topic.matchAllGroups && !groupSatisfied && source.name !== 'fulltext') {
      continue;
    }
    score += SOURCE_WEIGHTS[source.name] ?? 0;
    sourceMatches.push(source.name);
    matchedAliases.forEach((alias) => aliases.add(alias));
    reasons.push(`${source.name}: ${matchedAliases.join(', ')}`);
  }

  if (blockedByExclusion && score < 4) {
    return null;
  }

  const quantitativeSignals = Array.from(new Set([
    ...pickRelevantSegments(extractions, topic, RESULT_PATTERNS, 3),
    ...pickRelevantSegments(fulltext, topic, RESULT_PATTERNS, 3),
  ])).slice(0, 4);
  const populationContext = [
    ...pickRelevantSegments(queryCard, topic, POPULATION_PATTERNS, 1),
    ...pickRelevantSegments(extractions, topic, POPULATION_PATTERNS, 1),
    ...pickRelevantSegments(fulltext, topic, POPULATION_PATTERNS, 1),
  ][0] ?? '';
  const topicSignals = Array.from(new Set([
    ...pickRelevantSegments(extractions, topic, topic.aliases, 2),
    ...pickRelevantSegments(notes, topic, topic.aliases, 1),
    ...pickRelevantSegments(fulltext, topic, topic.aliases, 2),
  ])).slice(0, 4);

  const figureLinks = figures
    .filter((figure) => collectSourceMatches(figure.text, topic).matchedAliases.length > 0)
    .slice(0, 5)
    .map((figure) => `[[papers/${studyId}/figures/${figure.name.replace(/\.md$/i, '')}|${figure.name.replace(/\.md$/i, '')}]]`);

  const confidence = score >= 4 || (score >= 3 && sourceMatches.includes('fulltext') === false) ? 'confident' : (score >= 2 ? 'uncertain' : 'none');
  if (confidence === 'none') {
    return null;
  }

  const supportLinks = Array.from(new Set(sourceMatches.map((sourceName) => supportLink(studyId, sourceName)).filter(Boolean)));
  return {
    studyId,
    title: getField(queryCard, 'Title') || getField(citation, 'Title') || studyId,
    year: getField(queryCard, 'Year') || getField(citation, 'Year'),
    confidence,
    score,
    reason: reasons.join('; ') || 'weak topic match',
    matchedAliases: Array.from(aliases).sort(),
    matchBasis: `${Array.from(aliases).sort().join(', ')} via ${sourceMatches.join(', ')}`,
    sourceMatches,
    supportLinks,
    populationContext,
    quantitativeSignals,
    topicSignals,
    figureLinks,
  };
}

function buildReviewRow(topic, entry) {
  return `| ${topic.slug} | [[papers/${entry.studyId}/index|${entry.studyId}]] | ${entry.score} | ${markdownEscape(entry.reason)} |`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const vaultRoot = path.resolve(args.vault || process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Vault does not exist: ${vaultRoot}`);
  }
  if (!fs.existsSync(path.join(vaultRoot, MANIFEST_FILE))) {
    throw new Error(`Vault manifest is missing: ${path.join(vaultRoot, MANIFEST_FILE)}`);
  }

  const topicFilter = args.topic ? String(args.topic).trim() : null;
  const selectedTopics = topicFilter ? TOPIC_REGISTRY.filter((topic) => topic.slug === topicFilter) : TOPIC_REGISTRY;
  if (selectedTopics.length === 0) {
    throw new Error(`Unknown topic slug: ${topicFilter}`);
  }

  const paperRoot = path.join(vaultRoot, 'papers');
  const studyIds = fs.readdirSync(paperRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const synthRoot = path.join(vaultRoot, '_syntheses');
  const topicsRoot = path.join(synthRoot, 'topics');
  const reviewRoot = path.join(synthRoot, 'review');
  const reviewPath = path.join(reviewRoot, 'topic-assignment-uncertain.md');

  ensureDir(synthRoot);
  ensureDir(reviewRoot);
  if (!topicFilter) {
    rmrf(topicsRoot);
  }
  ensureDir(topicsRoot);

  const existingReviewRows = topicFilter
    ? parseExistingReviewRows(reviewPath).filter((row) => !row.startsWith(`| ${topicFilter} |`))
    : [];
  const reviewRows = [...existingReviewRows];

  for (const topic of selectedTopics) {
    const confidentEntries = [];
    const uncertainEntries = [];
    for (const studyId of studyIds) {
      const entry = buildEntryForPaper(vaultRoot, studyId, topic);
      if (!entry) {
        continue;
      }
      if (entry.confidence === 'confident') {
        confidentEntries.push(entry);
      } else if (entry.confidence === 'uncertain') {
        uncertainEntries.push(entry);
        reviewRows.push(buildReviewRow(topic, entry));
      }
    }

    confidentEntries.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.studyId.localeCompare(b.studyId);
    });
    uncertainEntries.sort((a, b) => b.score - a.score || a.studyId.localeCompare(b.studyId));

    const topicDir = path.join(topicsRoot, topic.slug);
    rmrf(topicDir);
    ensureDir(topicDir);
    writeFile(path.join(topicDir, 'index.md'), buildTopicOverview(topic, confidentEntries));
    writeFile(path.join(topicDir, 'evidence-table.md'), buildEvidenceTable(topic, confidentEntries));
    writeFile(path.join(topicDir, 'claims.md'), buildClaimsMarkdown(topic, confidentEntries));
    writeFile(path.join(topicDir, 'gaps.md'), buildGapsMarkdown(topic, confidentEntries, uncertainEntries));
    writeFile(path.join(topicDir, 'figures.md'), buildFiguresMarkdown(topic, confidentEntries));
  }

  writeFile(
    reviewPath,
    ['# Topic Assignment Uncertain', '', '| Topic | Study | Score | Reason |', '| --- | --- | --- | --- |', ...reviewRows.sort(), ''].join('\n'),
  );

  writeFile(
    path.join(synthRoot, 'index.md'),
    ['# Syntheses', '', ...selectedTopics.map((topic) => `- [[_syntheses/topics/${topic.slug}/index|${topic.name}]]`), ''].join('\n'),
  );

  console.log(`Vault synthesis complete: ${vaultRoot}`);
  console.log(`Topics built: ${selectedTopics.map((topic) => topic.slug).join(', ')}`);
}

main();
