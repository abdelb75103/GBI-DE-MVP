'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useActiveProfile } from '@/components/providers/active-profile-provider';
import { Button, Card, PanelHead, t } from '@/components/ui';

type ExportControlsProps = {
  paperIds: string[];
};

export function ExportControls({ paperIds }: ExportControlsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { profile } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <Card>
        <PanelHead title="Exports" />
        <p className={t.caption}>
          Bulk exports are limited to administrators. Open an individual paper to download its extracted data.
        </p>
      </Card>
    );
  }

  const triggerExport = (kind: 'csv' | 'json') => {
    if (paperIds.length === 0) {
      setError('No papers available to export');
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const response = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, paperIds }),
      });

      if (!response.ok) {
        let message = 'Unable to start export';
        try {
          const payload = await response.json();
          if (payload?.error) {
            message = payload.error;
          }
        } catch {
          message = `${message} (status ${response.status})`;
        }
        setError(message);
        return;
      }

      setMessage(kind.toUpperCase() + ' export ready');
      router.refresh();
    });
  };

  return (
    <Card>
      <PanelHead title="Exports" description="Launch a fresh dataset to share progress with downstream tools." />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => triggerExport('csv')} disabled={isPending}>
          Export CSV
        </Button>
        <Button variant="secondary" onClick={() => triggerExport('json')} disabled={isPending}>
          Export JSON
        </Button>
        {message ? (
          <span role="status" className="text-xs font-medium text-positive-ink">
            {message}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs font-medium text-negative-ink">
            {error}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
