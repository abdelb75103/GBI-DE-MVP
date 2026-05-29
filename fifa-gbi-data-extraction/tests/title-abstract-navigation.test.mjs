import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNextTitleAbstractRecordId,
  removeCompletedTitleAbstractRecord,
} from '../src/lib/screening/title-abstract-navigation.ts';

test('selects the next loaded title/abstract record after the saved record', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }, { id: 'record-3' }];

  assert.equal(getNextTitleAbstractRecordId(records, 'record-1'), 'record-2');
});

test('returns an empty selection when the saved record is the final loaded record', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }];

  assert.equal(getNextTitleAbstractRecordId(records, 'record-2'), '');
});

test('removes the saved record and promotes the next record to the top of the queue', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }, { id: 'record-3' }, { id: 'record-4' }];

  const result = removeCompletedTitleAbstractRecord(records, 'record-2');

  assert.equal(result.selectedId, 'record-3');
  assert.deepEqual(result.records.map((record) => record.id), ['record-3', 'record-1', 'record-4']);
});
