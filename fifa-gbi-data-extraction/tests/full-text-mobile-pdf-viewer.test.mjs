import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspaceSource = readFileSync(
  new URL('../src/components/full-text-screening-workspace-client.tsx', import.meta.url),
  'utf8',
);

const mobileViewerSource = readFileSync(
  new URL('../src/components/mobile-pdf-viewer.tsx', import.meta.url),
  'utf8',
);

test('routes mobile full-text rendering through the dedicated mobile PDF viewer', () => {
  assert.match(workspaceSource, /import \{ MobilePdfViewer \} from '@\/components\/mobile-pdf-viewer';/);
  assert.match(workspaceSource, /isMobile \? \(\s*<MobilePdfViewer[\s\S]*src=\{pdfDirectUrl\}/);
});

test('mobile PDF viewer renders pages with pdfjs and custom pinch zoom support', () => {
  assert.match(mobileViewerSource, /getDocument/);
  assert.match(mobileViewerSource, /touchmove/);
  assert.match(mobileViewerSource, /setZoom\(nextZoom\)/);
  assert.match(mobileViewerSource, /pageMetrics\.map/);
});
