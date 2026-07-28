'use client';

import { FormEvent, useId, useState } from 'react';

import { Button, Field, Modal, Textarea } from '@/components/ui';

type FlagReasonModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  initialReason?: string;
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export function FlagReasonModal({
  isOpen,
  title = 'Flag paper',
  description = 'Give a quick reason why this paper is being flagged.',
  initialReason = '',
  isPending = false,
  onCancel,
  onSubmit,
}: FlagReasonModalProps) {
  if (!isOpen) return null;

  return (
    <FlagReasonDialog
      key={initialReason}
      title={title}
      description={description}
      initialReason={initialReason}
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

type FlagReasonDialogProps = {
  title: string;
  description: string;
  initialReason: string;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

function FlagReasonDialog({
  title,
  description,
  initialReason,
  isPending,
  onCancel,
  onSubmit,
}: FlagReasonDialogProps) {
  const formId = useId();
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Add a short reason before flagging.');
      return;
    }
    onSubmit(trimmedReason);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      description={description}
      dismissible={!isPending}
      // The reason box holds typed text, so a stray backdrop click must not bin it.
      dismissOnBackdrop={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={isPending}>
            Flag paper
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <Field label="Reason" error={error}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError(null);
              }}
              rows={4}
              disabled={isPending}
              placeholder="Briefly describe what needs reviewer attention."
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
