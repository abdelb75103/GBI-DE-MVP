'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';

import { cn } from '@/components/ui/cn';

export type TabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  count?: number;
  /**
   * A view that exists but is not available to this reader right now, for
   * instance changing your vote on a record you never voted on. It stays
   * visible so the reader can see the option exists, and arrow keys skip it.
   */
  disabled?: boolean;
};

/**
 * Moves selection with the arrow keys, as the tab pattern requires. Home and
 * End jump to the ends. Selection follows focus (automatic activation), which
 * is right here because switching tabs is cheap and has no side effects.
 */
function useTabKeys<T extends string>(items: TabItem<T>[], value: T, onChange: (value: T) => void, vertical: boolean) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    const current = items.findIndex((item) => item.value === value);
    if (current < 0) return;

    // Each step walks on until it lands on something selectable, so a disabled
    // tab is passed over rather than trapping the arrow keys on it.
    const step = (from: number, delta: number) => {
      for (let i = 1; i <= items.length; i += 1) {
        const candidate = (from + delta * i + items.length * i) % items.length;
        if (!items[candidate].disabled) return candidate;
      }
      return null;
    };
    const firstEnabled = (order: number[]) => order.find((index) => !items[index].disabled) ?? null;

    let target: number | null = null;
    if (event.key === prevKey) target = step(current, -1);
    else if (event.key === nextKey) target = step(current, 1);
    else if (event.key === 'Home') target = firstEnabled(items.map((_, index) => index));
    else if (event.key === 'End') target = firstEnabled(items.map((_, index) => items.length - 1 - index));

    if (target === null) return;
    event.preventDefault();
    onChange(items[target].value);
    focusTab(target);
  };

  return { listRef, onKeyDown };
}

/**
 * Underlined tab bar. Scrolls horizontally rather than wrapping, so a ten-tab
 * extraction panel keeps one row on a phone.
 *
 * `orientation="vertical"` turns it into a left rail with the accent on the
 * leading edge. Use it when there are many tabs with long names and the reader
 * benefits from seeing all of them at once, as in the extraction workspace: a
 * horizontal bar would push most of the ten tabs off-screen.
 *
 * Pass `panelId` when the tabs control a single region, so each tab points at
 * the panel it reveals.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  orientation = 'horizontal',
  panelId,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  orientation?: 'horizontal' | 'vertical';
  panelId?: string;
  className?: string;
}) {
  const vertical = orientation === 'vertical';
  const { listRef, onKeyDown } = useTabKeys(items, value, onChange, vertical);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(
        vertical ? 'flex flex-col gap-0.5' : 'no-scrollbar flex gap-1 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            // Roving tabindex: one stop for the whole set, then arrow keys.
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative text-[13px] font-medium transition-[color,background-color] duration-[160ms] ease-gbi',
              'focus-visible:outline-none focus-visible:shadow-focus',
              'disabled:cursor-not-allowed disabled:opacity-45',
              vertical
                ? cn(
                    'min-h-9 rounded-ctl px-3 py-2 text-left',
                    'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent',
                    selected
                      ? 'bg-navy-50 font-semibold text-navy-600 before:bg-navy-600 dark:bg-[#14263f] dark:text-[#8ab6e8]'
                      : 'text-ink-muted hover:bg-surface-sunk hover:text-ink',
                  )
                : cn(
                    'min-h-[38px] shrink-0 px-3',
                    'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-[1px] after:bg-transparent',
                    selected ? 'font-semibold text-navy-600 after:bg-navy-600' : 'text-ink-muted hover:text-ink',
                  ),
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="ml-1.5 text-[11px] font-semibold text-ink-soft [font-variant-numeric:tabular-nums]">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Two to four mutually exclusive views. For more, use `Tabs`. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  panelId,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  panelId?: string;
  className?: string;
}) {
  const { listRef, onKeyDown } = useTabKeys(items, value, onChange, false);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('inline-flex gap-0.5 rounded-ctl bg-surface-sunk p-[3px] shadow-e0', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'min-h-[30px] rounded-md px-3 text-[13px] font-medium transition-[background-color,color] duration-[160ms] ease-gbi',
              'focus-visible:outline-none focus-visible:shadow-focus',
              'disabled:cursor-not-allowed disabled:opacity-45',
              selected ? 'bg-surface font-semibold text-ink shadow-e1' : 'text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
