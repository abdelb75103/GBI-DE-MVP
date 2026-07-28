'use client';

import { CaretDown, WarningCircle } from '@phosphor-icons/react';
// `ComponentPropsWithRef` rather than `*HTMLAttributes`: React 19 passes `ref`
// as an ordinary prop to function components, and callers need it (resetting a
// file input, focusing a field after an error).
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * Every control in the app carries a real label. The audit found nine input
 * designs and two search boxes with no associated label at all; `Field` is the
 * only sanctioned way to render one.
 */

const CONTROL =
  'w-full min-h-9 rounded-ctl border border-line-strong bg-surface px-2.5 py-[7px] text-[13px] text-ink ' +
  'placeholder:text-ink-soft hover:border-navy-300 ' +
  'focus:border-navy-600 focus:outline-none focus:shadow-focus-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const INVALID = 'border-negative hover:border-negative';

export type FieldProps = {
  label: ReactNode;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function Field({ label, hideLabel = false, help, error, className, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-xs font-semibold text-ink-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {help ? (
        <p id={helpId} className="text-xs text-ink-soft">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-negative-ink">
          <WarningCircle aria-hidden weight="fill" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithRef<'input'>) {
  return <input className={cn(CONTROL, rest['aria-invalid'] && INVALID, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-[76px] resize-y', rest['aria-invalid'] && INVALID, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentPropsWithRef<'select'>) {
  return (
    <span className="relative block">
      <select className={cn(CONTROL, 'appearance-none pr-[30px]', rest['aria-invalid'] && INVALID, className)} {...rest}>
        {children}
      </select>
      <CaretDown
        aria-hidden
        weight="bold"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
      />
    </span>
  );
}

export type CheckboxProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'ref'> & {
  label: ReactNode;
  /** Keep the label for screen readers only, e.g. a select-row cell in a table. */
  hideLabel?: boolean;
  /** Header checkbox state when only some rows are selected. */
  indeterminate?: boolean;
};

export function Checkbox({ label, hideLabel = false, indeterminate = false, className, ...rest }: CheckboxProps) {
  const boxRef = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no HTML attribute, so it has to be set imperatively.
  useEffect(() => {
    if (boxRef.current) boxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cn(
        'inline-flex min-h-6 items-center gap-2 text-[13px] text-ink-body [@media(pointer:coarse)]:min-h-11',
        className,
      )}
    >
      <span className="relative inline-grid shrink-0 place-content-center">
        <input
          ref={boxRef}
          type="checkbox"
          className={cn(
            'peer h-4 w-4 appearance-none rounded-tag border border-line-strong bg-surface',
            'checked:border-navy-600 checked:bg-navy-600 indeterminate:border-navy-600 indeterminate:bg-navy-600',
            'focus-visible:outline-none focus-visible:shadow-focus',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...rest}
        />
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 opacity-0 peer-checked:opacity-100"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto h-0.5 w-2 rounded-full bg-white opacity-0 peer-indeterminate:opacity-100"
        />
      </span>
      <span className={cn(hideLabel && 'sr-only')}>{label}</span>
    </label>
  );
}
