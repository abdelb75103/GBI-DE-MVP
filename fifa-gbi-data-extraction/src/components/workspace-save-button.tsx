'use client';

import { Button } from '@/components/ui';
import { useWorkspaceSave } from '@/components/workspace-save-manager';

export function WorkspaceSaveButton() {
  const { hasUnsavedChanges, isPending, handleSave } = useWorkspaceSave();

  if (!hasUnsavedChanges) {
    return null;
  }

  return (
    <>
      <Button variant="secondary" onClick={() => handleSave(false)} loading={isPending}>
        Save &amp; continue
      </Button>
      <Button variant="primary" onClick={() => handleSave(true)} loading={isPending}>
        Save &amp; complete
      </Button>
    </>
  );
}
