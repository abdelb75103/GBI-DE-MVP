'use client';

import { X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

/**
 * Built on the native `<dialog>` element, which gives the dialog role, a real
 * focus trap, Escape-to-close and an inert background for free. The app's
 * unsaved-changes flow used `window.confirm()` and a hand-rolled overlay with
 * none of those; both should route through here.
 */

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Set false for destructive confirmations that must be answered. */
  dismissible?: boolean;
  /**
   * Set false when the dialog contains unsaved input. A stray click just
   * outside the body should never silently discard something the user typed.
   * Escape still closes it, because that is deliberate.
   */
  dismissOnBackdrop?: boolean;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  dismissOnBackdrop = true,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Unique per instance: a hardcoded id collides if two modals ever mount together.
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-gbi-modal
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (dismissible && dismissOnBackdrop && event.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[min(560px,calc(100vw-2rem))] rounded-page bg-surface p-0 text-ink-body shadow-e2',
        'backdrop:bg-[rgba(5,24,45,0.55)] backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[16px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink">
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-[13px] text-ink-muted">{description}</p> : null}
        </div>
        {dismissible ? (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog" icon={<X weight="bold" />} />
        ) : null}
      </div>
      {children ? <div className="px-5 pb-4 text-[13px]">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-sunk px-5 py-3.5">{footer}</div>
      ) : null}
    </dialog>
  );
}
