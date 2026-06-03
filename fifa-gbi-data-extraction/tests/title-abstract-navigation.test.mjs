import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceAfterTitleAbstractDecision,
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

test('removes the saved record while preserving queue order', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }, { id: 'record-3' }, { id: 'record-4' }];

  const result = removeCompletedTitleAbstractRecord(records, 'record-2');

  assert.equal(result.selectedId, 'record-3');
  assert.deepEqual(result.records.map((record) => record.id), ['record-1', 'record-3', 'record-4']);
});

test('returns an empty selection after removing the final record', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }];

  const result = removeCompletedTitleAbstractRecord(records, 'record-2');

  assert.equal(result.selectedId, '');
  assert.deepEqual(result.records.map((record) => record.id), ['record-1']);
});

test('requests a top scroll when a decision advances to another loaded record', () => {
  const records = [{ id: 'record-1' }, { id: 'record-2' }, { id: 'record-3' }];

  const result = advanceAfterTitleAbstractDecision(records, 'record-1');

  assert.equal(result.selectedId, 'record-2');
  assert.equal(result.shouldScrollSelectedRecordToTop, true);
});

test('does not request a top scroll when a decision leaves no next record selected', () => {
  const records = [{ id: 'record-1' }];

  const result = advanceAfterTitleAbstractDecision(records, 'record-1');

  assert.equal(result.selectedId, '');
  assert.equal(result.shouldScrollSelectedRecordToTop, false);
});
