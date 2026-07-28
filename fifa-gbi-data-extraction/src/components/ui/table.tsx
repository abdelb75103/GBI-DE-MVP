import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/components/ui/cn';

/** Wide content scrolls inside its own container, never the page body. */
export function TableWrap({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-x-auto rounded-card bg-surface shadow-e1', className)} {...rest}>
      {children}
    </div>
  );
}

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn('w-full min-w-[640px] border-collapse text-[13px]', className)} {...rest}>
      {children}
    </table>
  );
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-surface-sunk px-3.5 py-2.5 text-left',
        'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-line px-3.5 py-3 align-middle', className)} {...rest}>
      {children}
    </td>
  );
}

export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-[160ms] ease-gbi hover:bg-surface-sunk [&:last-child>td]:border-b-0',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

/** Right-aligned numeric cell content. */
export const numericCell = 'text-right [font-variant-numeric:tabular-nums]';
