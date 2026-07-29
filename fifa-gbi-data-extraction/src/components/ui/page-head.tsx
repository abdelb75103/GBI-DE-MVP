import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * The page hero. A light card that lifts towards white in the middle and
 * settles into navy at the corners, with two soft blobs: navy at the top left,
 * a lighter blue at the bottom right. Both blobs stay in the navy family, so
 * the header carries atmosphere without introducing a second accent.
 *
 * The surface is light, so everything on it uses normal ink and normal button
 * variants. There is no inverted treatment.
 *
 * Copy rule: the eyebrow and heading name the thing on screen ("Your extraction
 * queue"), not the person looking at it.
 */
export function PageHead({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'relative isolate overflow-hidden rounded-page px-8 py-10',
        // Three layers, painted back to front: a navy blob anchored in the top
        // left corner, a lighter blue one in the bottom right, then the base
        // wash that lifts to near-white through the middle. Both blobs are
        // corner-anchored with a short falloff, so they stay tucked in rather
        // than spreading a haze across the card.
        'bg-[radial-gradient(circle_240px_at_0%_0%,rgba(11,58,112,0.26)_0%,rgba(11,58,112,0.09)_38%,transparent_66%),radial-gradient(circle_280px_at_100%_100%,rgba(72,132,204,0.32)_0%,rgba(72,132,204,0.10)_38%,transparent_68%),radial-gradient(115%_115%_at_50%_40%,var(--n-0)_0%,var(--navy-50)_58%,var(--navy-100)_100%)]',
        'shadow-[0_1px_2px_rgba(11,58,112,0.06),0_0_0_1px_var(--navy-100)]',
        'dark:bg-[radial-gradient(circle_200px_at_0%_0%,rgba(47,111,181,0.24)_0%,transparent_66%),radial-gradient(circle_240px_at_100%_100%,rgba(74,135,201,0.18)_0%,transparent_68%),radial-gradient(115%_115%_at_50%_40%,var(--surface-raise)_0%,#12233c_58%,#0d1b2e_100%)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_#1e3555]',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-navy-600">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{title}</h1>
          {description ? <p className="mt-2 max-w-[68ch] text-[13px] text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}
