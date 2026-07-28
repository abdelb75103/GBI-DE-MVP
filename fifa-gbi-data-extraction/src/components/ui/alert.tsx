import { CheckCircle, Info, WarningCircle, Warning } from '@phosphor-icons/react/dist/ssr';
import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import type { Tone } from '@/components/ui/tone';

const TONE: Record<Exclude<Tone, 'neutral'>, string> = {
  positive: 'border-positive-line bg-positive-tint text-positive-ink',
  negative: 'border-negative-line bg-negative-tint text-negative-ink',
  attention: 'border-attention-line bg-attention-tint text-attention-ink',
  info: 'border-info-line bg-info-tint text-info-ink',
};

const ICON = {
  positive: CheckCircle,
  negative: WarningCircle,
  attention: Warning,
  info: Info,
};

export type AlertProps = {
  tone?: Exclude<Tone, 'neutral'>;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === 'negative' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-card border p-3 px-3.5 text-[13px]', TONE[tone], className)}
    >
      <Icon aria-hidden weight="fill" className="mt-px h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title ? <strong className="mb-0.5 block font-semibold">{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}
