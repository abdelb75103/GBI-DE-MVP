import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import type { Category } from '@/components/ui/tone';

/**
 * A category tag. Source families and exclusion reasons are categories, not
 * decisions, so they use the low-chroma `cat-*` tint set and never borrow a
 * state colour. Tags also never take an icon: shape and saturation are what
 * separate the two systems at a glance.
 */

const CATEGORY_CLASS: Record<Category, string> = {
  mental: 'cat-mental',
  uefa: 'cat-uefa',
  fifa: 'cat-fifa',
  american: 'cat-american',
  aspetar: 'cat-aspetar',
  system: 'cat-system',
  referee: 'cat-referee',
  noexp: 'cat-noexp',
  retro: 'cat-retro',
  master: 'cat-master',
};

export type TagProps = {
  /** Omit for a plain neutral tag. */
  category?: Category;
  /** Monospace treatment for study IDs such as S042. */
  mono?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Tag({ category, mono = false, children, className, title }: TagProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-tag border px-[7px] text-[11px] font-medium tracking-[0.01em] whitespace-nowrap',
        category ? cn('tag--tint', CATEGORY_CLASS[category]) : 'border-line bg-surface-sunk text-ink-muted',
        mono && 'font-mono font-semibold tracking-normal text-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}
