#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_VAULT_PATH = path.join(os.homedir(), 'Desktop', 'Obsidian Vault', 'FIFA GBI Knowledge Vault');
const REQUIRED_PAPER_FILES = ['index.md', 'query-card.md', 'citation.md', 'notes.md', 'extractions.md', 'fulltext.md', 'backlinks.md', 'figures/index.md', 'chunks'];
const REQUIRED_SYNTHESIS_FILES = ['index.md', 'evidence-table.md', 'claims.md', 'gaps.md', 'figures.md'];
const MANIFEST_FILE = '.gbi-kb-manifest.json';
const WIKI_LINK_PATTERN = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;

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

function walkMarkdown(rootDir, filePaths = []) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(absolutePath, filePaths);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      filePaths.push(absolutePath);
    }
  }
  return filePaths;
}

function resolveWikiTarget(vaultRoot, currentFile, target) {
  const cleaned = target.replace(/\\/g, '/');
  if (/\.(png|jpg|jpeg|gif|webp|tif|tiff|pdf|jp2|ccitt|params)$/i.test(cleaned)) {
    const assetCandidates = [
      path.resolve(path.dirname(currentFile), cleaned),
      path.resolve(vaultRoot, cleaned),
    ];
    return assetCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  }
  const baseCandidates = [
    path.resolve(path.dirname(currentFile), `${cleaned}.md`),
    path.resolve(path.dirname(currentFile), cleaned, 'index.md'),
    path.resolve(vaultRoot, `${cleaned}.md`),
    path.resolve(vaultRoot, cleaned, 'index.md'),
  ];
  return baseCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const vaultRoot = path.resolve(args.vault || process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Vault does not exist: ${vaultRoot}`);
  }

  const manifestPath = path.join(vaultRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest is missing: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const paperRoot = path.join(vaultRoot, 'papers');
  const paperDirs = fs.existsSync(paperRoot)
    ? fs.readdirSync(paperRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];

  const issues = [];
  if (paperDirs.length !== manifest.paperCount) {
    issues.push(`Paper directory count ${paperDirs.length} does not match manifest count ${manifest.paperCount}`);
  }

  for (const studyId of paperDirs) {
    const dirPath = path.join(paperRoot, studyId);
    for (const relative of REQUIRED_PAPER_FILES) {
      if (!fs.existsSync(path.join(dirPath, relative))) {
        issues.push(`Missing ${relative} for ${studyId}`);
      }
    }
    if (!fs.existsSync(path.join(dirPath, 'source.pdf'))) {
      issues.push(`Missing source.pdf for ${studyId}`);
    }
    const chunkDir = path.join(dirPath, 'chunks');
    if (fs.existsSync(chunkDir) && fs.readdirSync(chunkDir).filter((name) => name.endsWith('.md')).length === 0) {
      issues.push(`No chunk markdown files for ${studyId}`);
    }
  }

  const reviewPath = path.join(vaultRoot, '_indexes', 'review', 'author-extraction-uncertain.md');
  const uncertainStudies = new Set(
    fs.existsSync(reviewPath)
      ? (fs.readFileSync(reviewPath, 'utf8').match(/\bS\d{3,}\b/g) ?? [])
      : [],
  );
  const authorAllPath = path.join(vaultRoot, '_indexes', 'by-author-all.md');
  const authorAllText = fs.existsSync(authorAllPath) ? fs.readFileSync(authorAllPath, 'utf8') : '';
  for (const studyId of uncertainStudies) {
    if (authorAllText.includes(`[[papers/${studyId}/index|${studyId}]]`)) {
      issues.push(`Uncertain author extraction paper appears in by-author-all.md: ${studyId}`);
    }
  }

  const markdownFiles = walkMarkdown(vaultRoot);
  for (const filePath of markdownFiles) {
    const contents = fs.readFileSync(filePath, 'utf8');
    let match;
    while ((match = WIKI_LINK_PATTERN.exec(contents)) !== null) {
      const target = match[1];
      if (target.endsWith('.pdf') || target.startsWith('http')) {
        continue;
      }
      const resolved = resolveWikiTarget(vaultRoot, filePath, target);
      if (!resolved) {
        issues.push(`Broken wiki link in ${path.relative(vaultRoot, filePath)} -> ${target}`);
      }
    }
  }

  const synthesisRoot = path.join(vaultRoot, '_syntheses', 'topics');
  const topicReviewPath = path.join(vaultRoot, '_syntheses', 'review', 'topic-assignment-uncertain.md');
  if (fs.existsSync(synthesisRoot)) {
    const topicDirs = fs.readdirSync(synthesisRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const topicSlug of topicDirs) {
      const topicDir = path.join(synthesisRoot, topicSlug);
      for (const relative of REQUIRED_SYNTHESIS_FILES) {
        if (!fs.existsSync(path.join(topicDir, relative))) {
          issues.push(`Missing ${relative} for synthesis topic ${topicSlug}`);
        }
      }

      const evidenceText = readOptional(path.join(topicDir, 'evidence-table.md'));
      if (evidenceText && !evidenceText.includes('[[papers/')) {
        issues.push(`Synthesis evidence table has no paper links for ${topicSlug}`);
      }
      const claimsText = readOptional(path.join(topicDir, 'claims.md'));
      if (claimsText && claimsText.includes('## ') && !claimsText.includes('Supporting sources: [[papers/')) {
        issues.push(`Synthesis claims lack supporting source links for ${topicSlug}`);
      }

      if (fs.existsSync(topicReviewPath)) {
        const reviewStudyIds = fs.readFileSync(topicReviewPath, 'utf8')
          .split('\n')
          .filter((line) => line.startsWith(`| ${topicSlug} |`))
          .flatMap((line) => line.match(/\bS\d{3,}\b/g) ?? []);
        for (const studyId of reviewStudyIds) {
          if (evidenceText.includes(`[[papers/${studyId}/index|${studyId}]]`)) {
            issues.push(`Uncertain topic assignment paper appears in confident synthesis output: ${topicSlug} ${studyId}`);
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    console.error('Vault check failed:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Vault check passed for ${vaultRoot}`);
  console.log(`Paper directories: ${paperDirs.length}`);
}

function readOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

main();
