'use client';

import { ArrowLeft, CheckCircle, FloppyDisk } from '@phosphor-icons/react';

import { useWorkspaceSave } from '@/components/workspace-save-manager';
import { Button, ButtonLink } from '@/components/ui';

type PaperActionButtonsProps = {
  readOnly?: boolean;
  backHref?: string;
};

export function PaperActionButtons({ readOnly = false, backHref = '/data-extraction' }: PaperActionButtonsProps) {
  const { hasUnsavedChanges, isPending, handleSave } = useWorkspaceSave();

  if (readOnly) {
    return (
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href={backHref} size="lg" icon={<ArrowLeft />}>
          Back to Data Extraction
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
      <Button
        variant="secondary"
        size="lg"
        icon={<FloppyDisk />}
        loading={isPending}
        disabled={!hasUnsavedChanges}
        onClick={() => handleSave(false)}
      >
        Save and Continue
      </Button>
      <Button variant="primary" size="lg" icon={<CheckCircle />} loading={isPending} onClick={() => handleSave(true)}>
        Save and Complete
      </Button>
      <ButtonLink href={backHref} size="lg" icon={<ArrowLeft />}>
        Back to Data Extraction
      </ButtonLink>
    </div>
  );
}
