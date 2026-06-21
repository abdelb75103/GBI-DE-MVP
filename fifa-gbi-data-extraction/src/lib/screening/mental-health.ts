import type { Paper, ScreeningRecord } from '@/lib/types';

export const MENTAL_HEALTH_TAG = 'mental_health';

const MENTAL_HEALTH_SIGNAL_PATTERN =
  /\b(?:mental health|mental ill-?health|psychological(?:-health)?|psychopatholog|depress(?:ion|ive)?|anx(?:iety|ious)?|stress|ptsd|post-traumatic stress|burnout|eating disorder|disordered eating|orthorexia|suicid(?:e|al)|reinjury anxiety|sport injury anxiety)\b/i;

const normalizeMetadataTags = (metadata: Record<string, unknown> | null | undefined): string[] => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [];
  }
  const rawTags = metadata.tags;
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return Array.from(
    new Set(
      rawTags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
};

export const hasMentalHealthTag = (metadata: Record<string, unknown> | null | undefined): boolean =>
  normalizeMetadataTags(metadata).includes(MENTAL_HEALTH_TAG);

export const addMentalHealthTag = (metadata: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  const tags = normalizeMetadataTags(base);
  if (!tags.includes(MENTAL_HEALTH_TAG)) {
    tags.push(MENTAL_HEALTH_TAG);
  }

  return {
    ...base,
    tags,
  };
};

const collectMentalHealthSignals = (input: {
  title?: string | null;
  abstract?: string | null;
  aiReason?: string | null;
  manualReason?: string | null;
}): string => [input.title, input.abstract, input.aiReason, input.manualReason].filter(Boolean).join('\n');

export const inferMentalHealthTag = (input: {
  title?: string | null;
  abstract?: string | null;
  aiReason?: string | null;
  manualReason?: string | null;
}): boolean => MENTAL_HEALTH_SIGNAL_PATTERN.test(collectMentalHealthSignals(input));

export const isMentalHealthScreeningRecord = (record: Pick<ScreeningRecord, 'metadata' | 'title' | 'abstract' | 'aiReason' | 'manualReason'>): boolean =>
  hasMentalHealthTag(record.metadata) || inferMentalHealthTag(record);

export const isMentalHealthPaper = (paper: Pick<Paper, 'metadata' | 'title'>): boolean =>
  hasMentalHealthTag(paper.metadata) || inferMentalHealthTag({ title: paper.title });
