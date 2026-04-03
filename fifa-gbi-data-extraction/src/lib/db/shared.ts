import type { PaperSession } from '@/lib/types';
import { getAdminServiceClient } from '@/lib/supabase';

type PaperRowMetadata = Record<string, unknown> | null | undefined;
type PaperMetadata = Record<string, unknown> | undefined;

export const normalizeRowMetadata = (metadata: PaperRowMetadata): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
};

export const normalizePaperMetadata = (metadata: PaperMetadata): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
};

// Session info is stored only in metadata (not assigned_to) to avoid race conditions
export const parseActiveSession = (metadata: Record<string, unknown>, paperId: string): PaperSession | null => {
  const raw = metadata.activeSession;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const session = raw as Partial<PaperSession>;

  if (!session.profileId || !session.startedAt) {
    return null;
  }

  return {
    paperId,
    profileId: session.profileId,
    fullName: session.fullName ?? '',
    startedAt: session.startedAt,
    lastHeartbeatAt: session.lastHeartbeatAt ?? session.startedAt,
  };
};

export const setActiveSessionMetadata = (
  metadata: Record<string, unknown>,
  session: PaperSession | null,
): Record<string, unknown> => {
  const nextMetadata = { ...metadata };
  if (session) {
    nextMetadata.activeSession = {
      profileId: session.profileId,
      fullName: session.fullName,
      startedAt: session.startedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
    };
  } else {
    delete nextMetadata.activeSession;
  }
  return nextMetadata;
};

export class PaperSessionConflictError extends Error {
  current: PaperSession;

  constructor(current: PaperSession, message = 'Another teammate is currently editing this paper.') {
    super(message);
    this.name = 'PaperSessionConflictError';
    this.current = current;
  }
}

const ensureSupabaseConfigured = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
};

export const supabaseClient = () => {
  ensureSupabaseConfigured();
  return getAdminServiceClient();
};

export const chunkValues = <T>(values: T[], size: number): T[][] => {
  if (size <= 0) {
    throw new Error('chunkValues size must be greater than 0.');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};
