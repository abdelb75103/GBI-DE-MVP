'use client';

import { useContext } from 'react';

import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
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
  const currentValue = localValue !== undefined ? localValue ?? '' : result?.value ?? '';

  const isSelected = supportsAi ? selected : true;
  const currentReviewState: ReviewState | undefined = requiresReview ? reviewState ?? 'pending' : undefined;
  const isPendingReview = Boolean(requiresReview && currentReviewState === 'pending');
  const reviewLocked = isPendingReview;
  const showReviewControls = isPendingReview && !readOnly && Boolean(onReviewDecision);
  const showReviewBadge = isPendingReview;

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
      ? { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' }
      : currentReviewState === 'declined'
        ? { label: 'Declined', className: 'bg-rose-100 text-rose-700' }
        : { label: 'Needs review', className: 'bg-amber-100 text-amber-700' };

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 text-sm shadow-sm ${
        supportsAi
          ? isSelected
            ? 'border-indigo-200/80 bg-indigo-50/70 text-indigo-800'
            : 'border-slate-200/70 bg-slate-50/60 text-slate-500'
          : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 text-sm font-semibold ${
          supportsAi ? 'text-indigo-900' : 'text-emerald-900'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {supportsAi && onSelectedChange ? (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={isSelected}
              onChange={(event) => onSelectedChange(event.target.checked)}
              disabled={readOnly}
            />
          ) : null}
          <span className="min-w-0 break-words">{definition.label}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {showReviewBadge ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reviewBadgeConfig.className}`}>
              {reviewBadgeConfig.label}
            </span>
          ) : null}
          {showReviewControls ? (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleApprove}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition ${
                  currentReviewState === 'approved'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-emerald-200/80 bg-white text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50'
                }`}
                aria-label="Approve AI suggestion"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={handleDecline}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition ${
                  currentReviewState === 'declined'
                    ? 'border-rose-500 bg-rose-500 text-white'
                    : 'border-rose-200/80 bg-white text-rose-600 hover:border-rose-400 hover:bg-rose-50'
                }`}
                aria-label="Decline AI suggestion"
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>
        {placeholder && (
          <span className="flex flex-shrink-0 text-[10px] font-normal text-slate-500" title={placeholder}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        )}
      </div>
      <textarea
        value={currentValue}
        disabled={readOnly || reviewLocked || (supportsAi ? !isSelected : false)}
        onChange={(event) => {
          if (readOnly || reviewLocked || (supportsAi && !isSelected)) {
            return;
          }
          handleChange(event.target.value);
        }}
        rows={3}
        placeholder={placeholder}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          readOnly || reviewLocked
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-75'
            : supportsAi
              ? 'border-indigo-200/80 focus:border-indigo-300 focus:ring-indigo-200/70'
              : 'border-emerald-200/80 focus:border-emerald-300 focus:ring-emerald-200/70'
        }`}
      />
      {reviewLocked ? (
        <p className="text-xs text-slate-500">Approve or decline the AI suggestion to edit this field.</p>
      ) : null}
    </div>
  );
}
