import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const readProjectFile = (relativePath) => readFileSync(
  path.resolve(import.meta.dirname, '..', relativePath),
  'utf8',
);

test('full-text queue refinements do not force a client remount', () => {
  const pageSource = readProjectFile('src/app/full-text-screening/page.tsx');

  assert.doesNotMatch(
    pageSource,
    /<FullTextScreeningClient\s+key=\{`\$\{context\.filter\}:\$\{context\.search\}:\$\{context\.page\}`\}/,
  );
});

test('full-text queue refinements keep the viewport stable during router updates', () => {
  const clientSource = readProjectFile('src/components/full-text-screening-client.tsx');

  assert.match(
    clientSource,
    /router\.replace\(buildFullTextQueueUrl\([\s\S]*?\),\s*\{\s*scroll:\s*false\s*\}\)/,
  );
});

test('full-text queue shows an in-place updating state instead of a hard refresh feel', () => {
  const clientSource = readProjectFile('src/components/full-text-screening-client.tsx');

  assert.match(clientSource, /aria-busy=\{isPending\}/);
  assert.match(clientSource, /Updating…/);
  assert.match(clientSource, /disabled=\{isPending\}/);
});
