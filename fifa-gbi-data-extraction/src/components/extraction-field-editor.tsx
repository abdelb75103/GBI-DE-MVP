'use client';

import { Check, X } from '@phosphor-icons/react';
import { useContext } from 'react';

import { Button, Checkbox, Field, Pill, Textarea, cn, t } from '@/components/ui';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import { normalizeGlobalFieldValue } from '@/lib/extraction/normalize';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';
import { WorkspaceSaveContext } from '@/components/workspace-save-manager';

type ReviewState = 'pending' | 'approved' | 'declined';
type ReviewAction = 'approve' | 'decline';

const MULTILINE_PLACEHOLDERS: Record<string, string> = {
  // Population-defining fields (use identifiers)
  ageCategory: 'e.g.,\nU19\nU21\nU16\nYouth\nSenior',
  sex: '',
  // Participant Characteristics
  fifaDiscipline: 'e.g.,\nAssociation football (11-a-side)\nFutsal\nBeach soccer\nPara football',
  levelOfPlay: 'e.g.,\namateur\nsemi-professional\nprofessional',
  // All other fields (values only, no labels)
  meanAge: '',
  sampleSizePlayers: '',
  numberOfTeams: '',
  observationDuration: '',
  injuryMedicalAttentionCount: 'If separated out in study. If not just use total injuries and ignore this.',
  injuryTimeLossCount: 'If separated out in study. If not just use total injuries and ignore this.',
  injuryMatchMedicalAttentionCount: 'If separated out in study. If not just use total match injuries and ignore this.',
  injuryMatchTimeLossCount: 'If separated out in study. If not just use total match injuries and ignore this.',
  injuryTrainingMedicalAttentionCount: 'If separated out in study. If not just use total training injuries and ignore this.',
  injuryTrainingTimeLossCount: 'If separated out in study. If not just use total training injuries and ignore this.',
  // Exposure (values only)
  seasonLength: '',
  numberOfSeasons: '',
  matchExposure: '',
  trainingExposure: '',
  // Injury Outcome (values only)
  injuryTotalCount: '',
  injuryIncidenceOverall: '',
  injuryIncidenceMatch: '',
  injuryIncidenceTraining: '',
  injuryIncidenceTimeLossOverall:
    'ONLY fill in when the study uses a medical-attention definition but also reports a separate time-loss incidence. Otherwise leave blank.',
  injuryIncidenceTimeLossMatch:
    'ONLY fill in when the study uses a medical-attention definition and separately reports a time-loss match incidence.',
  injuryIncidenceTimeLossTraining:
    'ONLY fill in when the study uses a medical-attention definition and separately reports a time-loss training incidence.',
  injuryMostCommonDiagnosis: 'e.g.,\nHamstring muscle injury\nAnkle ligament injury\nKnee ligament injury\nAdductor muscle injury',
  // Illness Outcome (values only)
  illnessTotalCount: '',
  illnessIncidenceOverall: '',
};

type ExtractionFieldEditorProps = {
  paperId: string;
  tab: ExtractionTab;
  definition: ExtractionFieldDefinition;
  result?: ExtractionFieldResult;
  supportsAi: boolean;
  selected?: boolean;
  onSelectedChange?: (value: boolean) => void;
  readOnly?: boolean;
  requiresReview?: boolean;
  reviewState?: ReviewState;
  onReviewDecision?: (action: ReviewAction) => void;
};

export function ExtractionFieldEditor({
  paperId,
  tab,
  definition,
  result,
  supportsAi,
  selected = true,
  onSelectedChange,
  readOnly = false,
  requiresReview = false,
  reviewState,
  onReviewDecision,
}: ExtractionFieldEditorProps) {
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const placeholder = MULTILINE_PLACEHOLDERS[definition.id] ?? '';

  // Get local value if it exists, otherwise use server value
  const localValue = getFieldValue(tab, definition.id);
  const currentValue =
    localValue !== undefined
      ? localValue ?? ''
      : normalizeGlobalFieldValue(definition.id, result?.value ?? '') ?? '';

  const isSelected = supportsAi ? selected : true;
  const currentReviewState: ReviewState | undefined = requiresReview ? reviewState ?? 'pending' : undefined;
  const isPendingReview = Boolean(requiresReview && currentReviewState === 'pending');
  const reviewLocked = isPendingReview;
  const showReviewControls = isPendingReview && !readOnly && Boolean(onReviewDecision);
  const showReviewBadge = isPendingReview;
  const controlDisabled = readOnly || reviewLocked || (supportsAi ? !isSelected : false);

  const handleChange = (value: string) => {
    updateField({
      paperId,
      tab,
      fieldId: definition.id,
      value,
      metric: definition.metric,
    });
  };

  const handleApprove = () => {
    if (!onReviewDecision || readOnly) {
      return;
    }
    onReviewDecision('approve');
  };

  const handleDecline = () => {
    if (!onReviewDecision || readOnly) {
      return;
    }
    onReviewDecision('decline');
    handleChange('');
  };

  const reviewBadgeConfig =
    currentReviewState === 'approved'
      ? { label: 'Approved', tone: 'positive' as const }
      : currentReviewState === 'declined'
        ? { label: 'Declined', tone: 'negative' as const }
        : { label: 'Needs review', tone: 'attention' as const };

  return (
    /**
     * Two zones, so the eye lands on the field name before the input. The name
     * sits on a sunk strip; the input sits on plain surface below it. The strip
     * is neutral rather than tinted with the accent: this is structure, not a
     * decision, and colour is reserved for decisions.
     */
    <div
      className={cn(
        'overflow-hidden rounded-card border border-line bg-surface text-[13px] shadow-e0',
        'transition-[border-color] duration-[160ms] ease-gbi focus-within:border-navy-300',
        supportsAi && !isSelected && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-sunk px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {supportsAi && onSelectedChange ? (
            <Checkbox
              label={`Include ${definition.label} in this extraction run`}
              hideLabel
              checked={isSelected}
              onChange={(event) => onSelectedChange(event.target.checked)}
              disabled={readOnly}
            />
          ) : null}
          {/* `aria-hidden`: the accessible name comes from the field's own label
              below, so without this a screen reader reads it twice. */}
          <span aria-hidden className="min-w-0 break-words text-[13px] font-semibold leading-snug text-ink">
            {definition.label}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {showReviewBadge ? (
            <Pill tone={reviewBadgeConfig.tone} dot>
              {reviewBadgeConfig.label}
            </Pill>
          ) : null}
          {showReviewControls ? (
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <Button
                size="icon"
                variant={currentReviewState === 'approved' ? 'primary' : 'secondary'}
                aria-label={`Approve ${definition.label} suggestion`}
                aria-pressed={currentReviewState === 'approved'}
                icon={<Check weight="bold" />}
                onClick={handleApprove}
              />
              <Button
                size="icon"
                variant={currentReviewState === 'declined' ? 'danger' : 'secondary'}
                aria-label={`Decline ${definition.label} suggestion`}
                aria-pressed={currentReviewState === 'declined'}
                icon={<X weight="bold" />}
                onClick={handleDecline}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-3.5">
        {/* The guidance is `help`, not a placeholder, so it stays readable once
            the field has a value in it. */}
        <Field label={definition.label} hideLabel help={placeholder || undefined}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={currentValue}
              disabled={controlDisabled}
              onChange={(event) => {
                if (controlDisabled) {
                  return;
                }
                handleChange(event.target.value);
              }}
              rows={3}
            />
          )}
        </Field>
        {reviewLocked ? (
          <p className={cn(t.caption, 'mt-2')}>Approve or decline the AI suggestion to edit this field.</p>
        ) : null}
      </div>
    </div>
  );
}
