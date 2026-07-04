import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readProjectFile = (relativePath) => readFileSync(
  new URL(`../${relativePath}`, import.meta.url),
  'utf8',
);

const pageSource = readProjectFile('src/app/data-extraction/page.tsx');
const dashboardSource = readProjectFile('src/components/data-extraction-dashboard-client.tsx');
const papersDashboardSource = readProjectFile('src/components/papers-dashboard-client.tsx');
const papersTableSource = readProjectFile('src/components/papers-table.tsx');

test('keeps the server page focused on auth and concurrent compact data loading', () => {
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/);
  assert.match(pageSource, /const activeProfile = await readActiveProfileSession\(\)/);
  assert.match(pageSource, /if \(!activeProfile\) \{\s*redirect\('\/profiles\/select'\);\s*\}/);
  assert.doesNotMatch(pageSource, /\bsearchParams\b/);

  const promiseAllBody = pageSource.match(/Promise\.all\(\[([\s\S]*?)\]\)/)?.[1];
  assert.ok(promiseAllBody, 'expected the dashboard reads to share one Promise.all');
  assert.match(promiseAllBody, /mockDb\.listDataExtractionPapers\(\)/);
  assert.match(promiseAllBody, /mockDb\.listExports\(\)/);
  assert.match(
    promiseAllBody,
    /isAdmin \? mockDb\.countPendingUploadQueueEntries\(\) : Promise\.resolve\(0\)/,
  );
  assert.doesNotMatch(pageSource, /mockDb\.listPapers\(/);
  assert.match(
    pageSource,
    /const dashboardPapers = isAdmin \? papers : papers\.filter\(\(paper\) => paper\.status !== 'archived'\)/,
  );

  assert.match(pageSource, /<DataExtractionDashboardClient/);
  assert.match(pageSource, /papers=\{dashboardPapers\}/);
  assert.match(pageSource, /exportJobs=\{exportJobs\}/);
  assert.match(pageSource, /pendingUploadCount=\{pendingUploadCount\}/);
});

test('derives every batch-dependent dashboard value from filtered papers', () => {
  assert.match(dashboardSource, /useSearchParams\(\)/);
  assert.match(dashboardSource, /const batchFilter = getDataExtractionBatchFilter\(searchParams\.get\('batch'\)\)/);
  assert.match(dashboardSource, /filterDataExtractionPapers\(papers, batchFilter\)/);
  assert.match(dashboardSource, /const countablePapers = filteredPapers\.filter/);
  assert.match(dashboardSource, /const tablePapers = filteredPapers\.filter/);
  assert.match(dashboardSource, /const dashboardTablePapers = isAdmin \? filteredPapers : tablePapers/);
  assert.match(dashboardSource, /const activePaperIds = tablePapers\.filter/);

  assert.match(dashboardSource, /<DashboardProgressVisual/);
  assert.match(dashboardSource, /totalPapers=\{totalPapers\}/);
  assert.match(dashboardSource, /completedPapers=\{progressCompletedCount\}/);
  assert.match(dashboardSource, /const contributorStats = countablePapers\.reduce/);
  assert.match(dashboardSource, /contributors=\{contributors\}/);
  assert.match(dashboardSource, /<ExportControls paperIds=\{activePaperIds\}/);
  assert.match(dashboardSource, /<PapersDashboardClient\s*key=\{batchFilter\}/);
  assert.match(dashboardSource, /papers=\{dashboardTablePapers\}/);
});

test('uses canonical real links while handling plain primary clicks client-side', () => {
  assert.match(
    dashboardSource,
    /getDataExtractionBatchHref\(\s*option\.value,\s*new URLSearchParams\(searchParams\.toString\(\)\)/,
  );

  const batchAnchor = dashboardSource.match(
    /<a\s+key=\{option\.value\}([\s\S]*?)className=/,
  )?.[1];
  assert.ok(batchAnchor, 'expected batch controls to render real anchors');
  assert.match(batchAnchor, /href=\{href\}/);
  assert.match(batchAnchor, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(batchAnchor, /event\.button !== 0/);
  assert.match(batchAnchor, /event\.metaKey/);
  assert.match(batchAnchor, /event\.ctrlKey/);
  assert.match(batchAnchor, /event\.shiftKey/);
  assert.match(batchAnchor, /event\.altKey/);

  const preventDefaultIndex = batchAnchor.indexOf('event.preventDefault()');
  const activeReturnIndex = batchAnchor.indexOf('if (active) return');
  const pushStateIndex = batchAnchor.indexOf("window.history.pushState(null, '', href)");
  assert.ok(preventDefaultIndex >= 0, 'expected plain clicks to prevent full navigation');
  assert.ok(activeReturnIndex > preventDefaultIndex, 'expected active links to stop after preventDefault');
  assert.ok(pushStateIndex > activeReturnIndex, 'expected pushState only for a changed batch');
});

test('uses the compact paper summary throughout the dashboard table components', () => {
  for (const source of [papersDashboardSource, papersTableSource]) {
    assert.match(source, /import type \{ DataExtractionPaperSummary \}/);
    assert.match(source, /papers: DataExtractionPaperSummary\[\]/);
    assert.doesNotMatch(source, /\bPaper\[\]/);
  }
});
