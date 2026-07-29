import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * One stat tile for the whole app. The tinted look is kept, but the tone comes
 * from what the metric *means*, not from where the tile sits in a row, and it
 * is a single hue so a tile can never imply a state that contradicts the status
 * pills beside it. The value stays ink: the tint already carries the tone.
 */

export type StatTone = 'total' | 'positive' | 'attention' | 'negative' | 'neutral';

/**
 * The tint holds most of the tile and only lets go near the far corner. Fading
 * it out at the midpoint left every tile reading as white with a stain on one
 * edge, which is not the tinted look the system asked for.
 *
 * `tokens.css` gives every state tint a dark value but leaves the navy and
 * neutral ramps light, because the navy ramp is also used for things that sit on
 * the always-navy page header. So the two tones that draw on those ramps carry
 * their own dark tint here rather than the ramp being changed underneath the
 * header.
 */
const SURFACE: Record<StatTone, string> = {
  total:
    'bg-[linear-gradient(135deg,var(--navy-100)_0%,var(--surface)_86%)] shadow-[0_1px_2px_rgba(11,58,112,.06),0_0_0_1px_var(--navy-100)] ' +
    'dark:bg-[linear-gradient(135deg,#12233c_0%,var(--surface)_86%)] dark:shadow-[0_1px_2px_rgba(0,0,0,.4),0_0_0_1px_#1e3555]',
  positive:
    'bg-[linear-gradient(135deg,var(--state-positive-tint)_0%,var(--surface)_86%)] shadow-[0_1px_2px_rgba(15,118,110,.07),0_0_0_1px_var(--state-positive-line)]',
  attention:
    'bg-[linear-gradient(135deg,var(--state-attention-tint)_0%,var(--surface)_86%)] shadow-[0_1px_2px_rgba(201,138,0,.08),0_0_0_1px_var(--state-attention-line)]',
  negative:
    'bg-[linear-gradient(135deg,var(--state-negative-tint)_0%,var(--surface)_86%)] shadow-[0_1px_2px_rgba(179,38,30,.07),0_0_0_1px_var(--state-negative-line)]',
  neutral:
    'bg-[linear-gradient(135deg,var(--n-100)_0%,var(--surface)_86%)] shadow-e1 ' +
    'dark:bg-[linear-gradient(135deg,var(--surface-raise)_0%,var(--surface)_86%)]',
};

// Large fills use the viz ramp, so a tile's bar and the progress ring read as
// the same colour and stay legible at a glance.
const BAR: Record<StatTone, string> = {
  total: 'bg-viz-total',
  positive: 'bg-viz-positive',
  attention: 'bg-viz-attention',
  negative: 'bg-viz-negative',
  neutral: 'bg-viz-neutral',
};

export type StatTileProps = {
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
  /** Top-right slot: a pill, an icon, a count. */
  aside?: ReactNode;
  /** 0-100. Renders the progress bar under the value. */
  progress?: number;
  meta?: ReactNode;
  className?: string;
};

export function StatTile({ label, value, tone = 'neutral', aside, progress, meta, className }: StatTileProps) {
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <div className={cn('relative overflow-hidden rounded-card p-4', SURFACE[tone], className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-ink-soft">{label}</span>
        {aside ? <span className="shrink-0">{aside}</span> : null}
      </div>
      <div className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink [font-variant-numeric:tabular-nums]">
        {value}
      </div>
      {meta ? <div className="mt-2 text-xs text-ink-soft">{meta}</div> : null}
      {pct !== null ? (
        <div className="mt-3 h-1 overflow-hidden rounded-[2px] bg-[rgba(15,23,42,0.07)] dark:bg-[rgba(255,255,255,0.1)]">
          <span className={cn('block h-full rounded-[2px]', BAR[tone])} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** A small delta readout for a stat tile's `meta` slot. */
export function StatDelta({ direction, children }: { direction: 'up' | 'down'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold',
        direction === 'up' ? 'text-positive-ink' : 'text-negative-ink',
      )}
    >
      {children}
    </span>
  );
}
