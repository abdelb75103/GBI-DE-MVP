import assert from 'node:assert/strict';
import test from 'node:test';

import { splitStructuredAbstract } from '../src/lib/screening/title-abstract-sections.ts';

test('splits common structured abstract headings into sections', () => {
  const sections = splitStructuredAbstract(
    'Aim: Describe injury patterns. Results: Injuries were common. Conclusion: Prevention work is needed.',
  );

  assert.deepEqual(sections, [
    { heading: 'Aim', body: 'Describe injury patterns.' },
    { heading: 'Results', body: 'Injuries were common.' },
    { heading: 'Conclusion', body: 'Prevention work is needed.' },
  ]);
});

test('keeps unstructured abstracts as one section', () => {
  const sections = splitStructuredAbstract('This abstract has no formal headings.');

  assert.deepEqual(sections, [
    { heading: null, body: 'This abstract has no formal headings.' },
  ]);
});
