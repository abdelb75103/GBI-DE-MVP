import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const work = path.join(root, 'tmp', 'full-text-skill-validation-2026-06-19');
const out = path.join(work, 'extension');
const pdfDir = path.join(out, 'blinded-pdfs');
fs.mkdirSync(pdfDir, { recursive: true });

const used = new Set([
  ...JSON.parse(fs.readFileSync(path.join(work, 'sealed-calibration-labels.json'))),
  ...JSON.parse(fs.readFileSync(path.join(work, 'sealed-holdout-labels.json'))),
].map((x) => x.sourceRecordId));

const includeDirs = [
  'Full Text - Data Extraaction/data extraction 1st',
  'Full Text - Data Extraaction/extraction 2 pdfs',
  'Full Text - Data Extraaction/extraction tree PDFs',
].map((p) => path.join(root, p));
const includes = includeDirs.flatMap((dir) => fs.readdirSync(dir).filter((n) => /\.pdf$/i.test(n)).map((n) => {
  const local = path.join(dir, n);
  return { sourceRecordId: crypto.createHash('sha256').update(local).digest('hex'), title: n.replace(/\.pdf$/i, ''), local };
})).filter((x) => !used.has(x.sourceRecordId));

const seenTitles = new Set();
const uniqueIncludes = includes.filter((x) => {
  const key = x.title.toLowerCase().replace(/-1$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  if (seenTitles.has(key)) return false;
  seenTitles.add(key);
  return true;
}).sort((a, b) => crypto.createHash('sha256').update(`${a.sourceRecordId}:extension`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${b.sourceRecordId}:extension`).digest('hex'))).slice(0, 4)
  .map((x) => ({ ...x, historicalDecision: 'include', historicalReason: null }));

const excludedSource = JSON.parse(fs.readFileSync(path.join(work, 'covidence-excluded-sealed-source.json')));
const excludes = excludedSource.filter((x) => x.pdfUrl && !used.has(`covidence-${x.covidenceNumber}`))
  .map((x) => ({ sourceRecordId: `covidence-${x.covidenceNumber}`, title: x.title, url: x.pdfUrl, historicalDecision: 'exclude', historicalReason: x.reason }))
  .sort((a, b) => crypto.createHash('sha256').update(`${a.sourceRecordId}:extension`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${b.sourceRecordId}:extension`).digest('hex'))).slice(0, 4);

const selected = [...uniqueIncludes, ...excludes].sort((a, b) => crypto.createHash('sha256').update(`${a.sourceRecordId}:blind`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${b.sourceRecordId}:blind`).digest('hex')));
const manifest = [];
const labels = [];
for (let i = 0; i < selected.length; i += 1) {
  const row = selected[i];
  const neutralId = `E${String(i + 1).padStart(2, '0')}`;
  const bytes = row.local ? fs.readFileSync(row.local) : Buffer.from(await (await fetch(row.url)).arrayBuffer());
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${neutralId} is not a PDF`);
  const pdfPath = path.join(pdfDir, `${neutralId}.pdf`);
  fs.writeFileSync(pdfPath, bytes);
  manifest.push({ neutralId, title: row.title, pdfPath, pdfSha256: crypto.createHash('sha256').update(bytes).digest('hex'), pdfSize: bytes.length });
  labels.push({ neutralId, historicalDecision: row.historicalDecision, historicalReason: row.historicalReason, sourceRecordId: row.sourceRecordId });
}
fs.writeFileSync(path.join(out, 'blinded-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(out, 'sealed-labels.json'), JSON.stringify(labels, null, 2));
console.log(`prepared=${manifest.length}`);
