'use client';

import { Archive, CheckCircle, CircleDashed, Clock, Flag, ListChecks } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import { Pill } from '@/components/ui/pill';
import { Tag } from '@/components/ui/tag';
import type { Category, Tone } from '@/components/ui/tone';
import type { PaperStatus } from '@/lib/types';

/**
 * `PaperStatus` mixes two unrelated things: six workflow states, which are
 * decisions and therefore carry a state colour, and ten source families, which
 * are categories and must never borrow one. They render as different components
 * so a row can show both at once without the colours competing.
 */

type WorkflowState = {
  label: string;
  tone: Tone;
  icon: Icon;
};

// Labels are sentence case throughout, matching the approved proposal. Only
// initialisms stay capitalised.
const WORKFLOW_STATES = {
  uploaded: { label: 'Uploaded', tone: 'neutral', icon: CircleDashed },
  processing: { label: 'Processing', tone: 'attention', icon: Clock },
  extracted: { label: 'Extracted', tone: 'positive', icon: CheckCircle },
  flagged: { label: 'Flagged', tone: 'negative', icon: Flag },
  qa_review: { label: 'QA review', tone: 'info', icon: ListChecks },
  archived: { label: 'Archived', tone: 'neutral', icon: Archive },
} as const satisfies Partial<Record<PaperStatus, WorkflowState>>;

const SOURCE_FAMILIES = {
  mental_health: { label: 'Mental health', category: 'mental' },
  uefa: { label: 'UEFA', category: 'uefa' },
  no_exposure: { label: 'No exposure', category: 'noexp' },
  fifa_data: { label: 'FIFA data', category: 'fifa' },
  aspetar_asprev: { label: 'Aspetar ASPREV', category: 'aspetar' },
  american_data: { label: 'American data', category: 'american' },
  systematic_review: { label: 'Systematic review', category: 'system' },
  referee: { label: 'Referee', category: 'referee' },
  retrospective_substudy_analysis: { label: 'Retrospective sub-study', category: 'retro' },
  uefa_master_extraction: { label: 'UEFA master extraction', category: 'master' },
} as const satisfies Partial<Record<PaperStatus, { label: string; category: Category }>>;

export type WorkflowStatus = keyof typeof WORKFLOW_STATES;
export type SourceFamily = keyof typeof SOURCE_FAMILIES;

export function isWorkflowStatus(status: PaperStatus): status is WorkflowStatus {
  return status in WORKFLOW_STATES;
}

export function isSourceFamily(status: PaperStatus): status is SourceFamily {
  return status in SOURCE_FAMILIES;
}

/**
 * The tone a record rail takes for a given status. Source families are
 * categories, so they carry no decision colour and fall back to neutral. Derived
 * from the same map as the pill so a row's rail can never contradict its pill.
 */
export function statusTone(status: PaperStatus): Tone {
  return isWorkflowStatus(status) ? WORKFLOW_STATES[status].tone : 'neutral';
}

export function statusLabel(status: PaperStatus): string {
  if (isWorkflowStatus(status)) return WORKFLOW_STATES[status].label;
  if (isSourceFamily(status)) return SOURCE_FAMILIES[status].label;
  return status;
}

/** A workflow state: uploaded, processing, extracted, flagged, QA review, archived. */
export function StatePill({ status, className }: { status: WorkflowStatus; className?: string }) {
  const state = WORKFLOW_STATES[status];
  const Glyph = state.icon;
  return (
    <Pill tone={state.tone} icon={<Glyph weight="fill" />} className={className}>
      {state.label}
    </Pill>
  );
}

/** A source family. A category, so it uses the tint set and never a state colour. */
export function SourceFamilyTag({ status, className }: { status: SourceFamily; className?: string }) {
  const family = SOURCE_FAMILIES[status];
  return (
    <Tag category={family.category} className={className} title={family.label}>
      {family.label}
    </Tag>
  );
}

/**
 * Renders whichever of the two a `PaperStatus` turns out to be. Prefer
 * `StatePill` or `SourceFamilyTag` directly where the kind is known.
 */
export function StatusPill({ status, className }: { status: PaperStatus; className?: string }) {
  if (isWorkflowStatus(status)) return <StatePill status={status} className={className} />;
  if (isSourceFamily(status)) return <SourceFamilyTag status={status} className={className} />;
  return <Tag className={className}>{status}</Tag>;
}
