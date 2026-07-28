import { cn } from '@/components/ui/cn';
import type { Tone } from '@/components/ui/tone';

const FILL: Record<Tone, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  attention: 'bg-attention',
  neutral: 'bg-n-400',
  info: 'bg-navy-600',
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export type MeterProps = {
  /** 0-100. */
  value: number;
  tone?: Tone;
  label: string;
  className?: string;
};

export function Meter({ value, tone = 'info', label, className }: MeterProps) {
  const pct = clamp(value);
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 overflow-hidden rounded-[3px] bg-n-200 dark:bg-[#22304a]', className)}
    >
      <span className={cn('block h-full rounded-[3px]', FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export type MeterSegment = {
  key: string;
  value: number;
  tone: Tone;
  label: string;
};

/** One bar carrying every state. Used on progress summaries. */
export function MeterStack({ segments, className }: { segments: MeterSegment[]; className?: string }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);

  return (
    <div className={cn('flex h-2 gap-0.5 overflow-hidden rounded-[4px] bg-n-200 dark:bg-[#22304a]', className)}>
      {segments.map((segment) => {
        const pct = total > 0 ? (Math.max(0, segment.value) / total) * 100 : 0;
        if (pct === 0) return null;
        return (
          <span
            key={segment.key}
            title={`${segment.label}: ${segment.value}`}
            className={cn('block h-full', FILL[segment.tone])}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
