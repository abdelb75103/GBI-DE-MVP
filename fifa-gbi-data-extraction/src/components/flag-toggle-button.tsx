'use client';

import { Flag } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FlagReasonModal } from '@/components/flag-reason-modal';
import { Button } from '@/components/ui';

type FlagToggleButtonProps = {
  paperId: string;
  isFlagged: boolean;
};

export function FlagToggleButton({ paperId, isFlagged }: FlagToggleButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);

  const handleClick = () => {
    if (isFlagged) {
      startTransition(async () => {
        setError(null);
        const response = await fetch(`/api/papers/${paperId}/flag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: null }),
        });

        if (!response.ok) {
          const payload = await response.json();
          setError(payload.error ?? 'Unable to clear flag');
          return;
        }

        router.refresh();
      });
      return;
    }

    setIsReasonModalOpen(true);
  };

  const submitFlagReason = (reason: string) => {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/papers/${paperId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? 'Unable to flag paper');
        return;
      }

      setIsReasonModalOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={isFlagged ? 'dangerSoft' : 'secondary'}
        // Flagging opens a dialog to collect a reason; clearing a flag acts
        // immediately. Announce whichever this click will actually do.
        aria-pressed={isFlagged ? true : undefined}
        aria-haspopup={isFlagged ? undefined : 'dialog'}
        icon={<Flag weight={isFlagged ? 'fill' : 'regular'} />}
        onClick={handleClick}
        loading={isPending}
      >
        {isFlagged ? 'Clear flag' : 'Flag'}
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-negative-ink">
          {error}
        </span>
      ) : null}
      <FlagReasonModal
        isOpen={isReasonModalOpen}
        isPending={isPending}
        onCancel={() => setIsReasonModalOpen(false)}
        onSubmit={submitFlagReason}
      />
    </div>
  );
}
