import assert from 'node:assert/strict';
import test from 'node:test';

import { getNextTitleAbstractRecordId } from '../src/lib/screening/title-abstract-navigation.ts';

test('selects the next loaded title/abstract record after the saved record', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }, { id: 'record-3' }];

  assert.equal(getNextTitleAbstractRecordId(records, 'record-1'), 'record-2');
});

test('returns an empty selection when the saved record is the final loaded record', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }];

  assert.equal(getNextTitleAbstractRecordId(records, 'record-2'), '');
});
