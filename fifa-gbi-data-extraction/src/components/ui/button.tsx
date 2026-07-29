import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

// The base sets the border *width* only. It used to set `border-transparent`
// too, which beat every variant's border colour in the cascade regardless of
// class order, so `secondary` and `dangerSoft` shipped with an invisible edge.
// Each variant now names its own colour, transparent included.
const BASE =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ctl border text-[13px] font-semibold tracking-[-0.005em] ' +
  'transition-[background-color,border-color,color,transform] duration-[160ms] ease-gbi ' +
  'focus-visible:outline-none focus-visible:shadow-focus active:enabled:translate-y-px ' +
  'disabled:cursor-not-allowed';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-navy-600 text-white hover:enabled:bg-navy-500',
  secondary: 'border-line-strong bg-surface text-ink hover:enabled:border-navy-300 hover:enabled:bg-n-50',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:enabled:bg-surface-sunk hover:enabled:text-ink',
  danger: 'border-transparent bg-negative text-white hover:enabled:bg-[#96201a]',
  // An engaged destructive toggle (a paper is flagged), not a destructive action.
  dangerSoft: 'border-negative-line bg-negative-tint text-negative-ink hover:enabled:border-negative',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[30px] px-2.5 text-xs',
  md: 'min-h-9 px-3.5',
  lg: 'min-h-11 px-5 text-sm',
  // 36px on a mouse, 44px under a finger.
  icon: 'min-h-9 w-9 p-0 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:w-11',
};

/** Shared so a link can be styled as a button without duplicating the recipe. */
export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon. Sized by the button, so pass the bare Phosphor element. */
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const spinnerColour = variant === 'primary' || variant === 'danger' ? 'border-white/35 border-t-white' : 'border-n-300 border-t-navy-600';

  return (
    <button
      type={type}
      // A loading button is inert but not dimmed: fading it reads as "unavailable"
      // rather than "working".
      className={cn(BASE, VARIANT[variant], SIZE[size], disabled && !loading && 'opacity-45', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className={cn('absolute h-3.5 w-3.5 animate-[gbi-spin_700ms_linear_infinite] rounded-full border-2', spinnerColour)}
        />
      ) : null}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {icon ? (
          <span aria-hidden className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
            {icon}
          </span>
        ) : null}
        {children}
      </span>
    </button>
  );
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

/**
 * A navigation that looks like a button. Kept separate from `Button` so the
 * element stays an anchor: a link that must remain middle-clickable and
 * copyable is never a `<button>` with an onClick.
 */
export function ButtonLink({ href, variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonClasses(variant, size, className), 'no-underline')} {...rest}>
      {icon ? (
        <span aria-hidden className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
          {icon}
        </span>
      ) : null}
      {children}
    </Link>
  );
}
