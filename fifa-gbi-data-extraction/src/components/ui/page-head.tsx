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
        'relative isolate overflow-hidden rounded-page px-7 py-6',
        // Light in the centre, navy at the corners.
        'bg-[radial-gradient(115%_115%_at_50%_38%,var(--n-0)_0%,var(--navy-50)_52%,var(--navy-100)_100%)]',
        'shadow-[0_1px_2px_rgba(11,58,112,0.06),0_0_0_1px_var(--navy-100)]',
        'dark:bg-[radial-gradient(115%_115%_at_50%_38%,var(--surface-raise)_0%,#12233c_55%,#0d1b2e_100%)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_#1e3555]',
        className,
      )}
    >
      {/* Navy at the top left, a lighter blue at the bottom right. Same family,
          so the header has depth without a second accent. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-[70px] -top-[120px] -z-10 h-[300px] w-[300px] rounded-full bg-[rgba(11,58,112,0.30)] blur-[52px] dark:bg-[rgba(47,111,181,0.28)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[160px] -right-[60px] -z-10 h-[360px] w-[360px] rounded-full bg-[rgba(102,153,214,0.38)] blur-[52px] dark:bg-[rgba(74,135,201,0.22)]"
      />
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
