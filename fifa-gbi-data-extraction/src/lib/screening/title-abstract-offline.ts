import type { ScreeningRecord } from '@/lib/types';

export const TITLE_ABSTRACT_OFFLINE_RESERVATION_KEY = 'titleAbstractOfflineReservation';

export type TitleAbstractOfflineReservationStatus = 'active' | 'completed' | 'released';

export type TitleAbstractOfflineReservation = {
  packId: string;
  reviewerProfileId: string;
  reviewerName?: string | null;
  reservedAt: string;
  status: TitleAbstractOfflineReservationStatus;
};

type TitleAbstractOfflineMetadata = {
  [TITLE_ABSTRACT_OFFLINE_RESERVATION_KEY]?: unknown;
  titleAbstractPromotedRecordId?: unknown;
};

const isReservationStatus = (value: unknown): value is TitleAbstractOfflineReservationStatus =>
  value === 'active' || value === 'completed' || value === 'released';

export const getTitleAbstractOfflineReservation = (
  recordOrMetadata: Pick<ScreeningRecord, 'metadata'> | Record<string, unknown> | null | undefined,
): TitleAbstractOfflineReservation | null => {
  const metadata = (
    recordOrMetadata && typeof recordOrMetadata === 'object' && 'metadata' in recordOrMetadata
      ? recordOrMetadata.metadata
      : recordOrMetadata
  ) as TitleAbstractOfflineMetadata | null | undefined;

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const raw = metadata[TITLE_ABSTRACT_OFFLINE_RESERVATION_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const candidate = raw as Partial<TitleAbstractOfflineReservation>;
  if (!candidate.packId || !candidate.reviewerProfileId || !candidate.reservedAt || !isReservationStatus(candidate.status)) {
    return null;
  }

  return {
    packId: candidate.packId,
    reviewerProfileId: candidate.reviewerProfileId,
    reviewerName: candidate.reviewerName ?? null,
    reservedAt: candidate.reservedAt,
    status: candidate.status,
  };
};

export const hasActiveTitleAbstractOfflineReservation = (
  recordOrMetadata: Pick<ScreeningRecord, 'metadata'> | Record<string, unknown> | null | undefined,
) => getTitleAbstractOfflineReservation(recordOrMetadata)?.status === 'active';

export const isTitleAbstractReservedForReviewer = (
  recordOrMetadata: Pick<ScreeningRecord, 'metadata'> | Record<string, unknown> | null | undefined,
  reviewerProfileId: string,
) => {
  const reservation = getTitleAbstractOfflineReservation(recordOrMetadata);
  return reservation?.status === 'active' && reservation.reviewerProfileId === reviewerProfileId;
};

export const shouldHideFromNormalTitleAbstractQueue = (
  recordOrMetadata: Pick<ScreeningRecord, 'metadata'> | Record<string, unknown> | null | undefined,
  reviewerProfileId: string,
) => isTitleAbstractReservedForReviewer(recordOrMetadata, reviewerProfileId);

export const setTitleAbstractOfflineReservation = (
  metadata: Record<string, unknown> | null | undefined,
  reservation: TitleAbstractOfflineReservation,
): Record<string, unknown> => ({
  ...(metadata ?? {}),
  [TITLE_ABSTRACT_OFFLINE_RESERVATION_KEY]: reservation,
});

export const clearTitleAbstractOfflineReservation = (
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  const next = { ...(metadata ?? {}) };
  delete next[TITLE_ABSTRACT_OFFLINE_RESERVATION_KEY];
  return next;
};
