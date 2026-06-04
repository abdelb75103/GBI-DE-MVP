import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearTitleAbstractOfflineReservation,
  getTitleAbstractOfflineReservation,
  hasActiveTitleAbstractOfflineReservation,
  isTitleAbstractReservedForReviewer,
  setTitleAbstractOfflineReservation,
  shouldHideFromNormalTitleAbstractQueue,
} from '../src/lib/screening/title-abstract-offline.ts';

const reservation = {
  packId: 'offline-pack-1',
  reviewerProfileId: 'reviewer-1',
  reviewerName: 'Reviewer One',
  reservedAt: '2026-06-04T10:00:00.000Z',
  status: 'active',
};

test('reads an active title/abstract offline reservation from record metadata', () => {
  const metadata = setTitleAbstractOfflineReservation({ existing: true }, reservation);

  assert.deepEqual(getTitleAbstractOfflineReservation(metadata), reservation);
  assert.equal(hasActiveTitleAbstractOfflineReservation(metadata), true);
  assert.equal(isTitleAbstractReservedForReviewer(metadata, 'reviewer-1'), true);
  assert.equal(shouldHideFromNormalTitleAbstractQueue({ metadata }, 'reviewer-1'), true);
});

test('does not hide released or completed offline reservations from normal queue', () => {
  for (const status of ['released', 'completed']) {
    const metadata = setTitleAbstractOfflineReservation({}, { ...reservation, status });

    assert.equal(hasActiveTitleAbstractOfflineReservation(metadata), false);
    assert.equal(shouldHideFromNormalTitleAbstractQueue({ metadata }, 'reviewer-1'), false);
  }
});

test('does not hide another reviewer active offline reservation for the current reviewer', () => {
  const metadata = setTitleAbstractOfflineReservation({}, {
    ...reservation,
    reviewerProfileId: 'reviewer-2',
  });

  assert.equal(hasActiveTitleAbstractOfflineReservation(metadata), true);
  assert.equal(isTitleAbstractReservedForReviewer(metadata, 'reviewer-1'), false);
  assert.equal(shouldHideFromNormalTitleAbstractQueue({ metadata }, 'reviewer-1'), false);
});

test('ignores malformed reservation metadata', () => {
  const metadata = {
    titleAbstractOfflineReservation: {
      packId: 'pack',
      status: 'active',
    },
  };

  assert.equal(getTitleAbstractOfflineReservation(metadata), null);
  assert.equal(hasActiveTitleAbstractOfflineReservation(metadata), false);
});

test('clears title/abstract offline reservation metadata', () => {
  const metadata = clearTitleAbstractOfflineReservation(setTitleAbstractOfflineReservation({ keep: 'value' }, reservation));

  assert.deepEqual(metadata, { keep: 'value' });
});
