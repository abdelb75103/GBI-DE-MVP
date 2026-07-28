'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Card, Field, Select, Tag, t } from '@/components/ui';

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

type AssignmentManagerProps = {
  paperId: string;
  currentAssigneeId: string | null;
  currentAssigneeName?: string | null;
};

export function AssignmentManager({ paperId, currentAssigneeId, currentAssigneeName }: AssignmentManagerProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentAssigneeId);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Fetch profiles
    fetch('/api/profiles')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setProfiles(data.profiles ?? []);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleAssignmentChange = (userId: string | null) => {
    setSelectedUserId(userId);
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch(`/api/papers/${paperId}/assignment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo: userId }),
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string; paper?: unknown };

        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update assignment');
        }

        // Refresh the page to show updated assignment
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update assignment');
        // Revert selection on error
        setSelectedUserId(currentAssigneeId);
      }
    });
  };

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <p className={t.label}>Assignment</p>
          <p className="mt-1 text-xs text-ink-soft">Manage paper assignment. Only visible to administrators.</p>
        </div>

        {currentAssigneeName ? (
          <div className="flex items-center gap-2 rounded-ctl bg-surface-sunk px-3 py-2">
            <p className="text-xs font-medium text-ink-muted">Currently assigned to</p>
            <Tag title={currentAssigneeName}>{currentAssigneeName}</Tag>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-xs text-ink-soft">Loading users...</p>
        ) : error && !profiles.length ? (
          <p role="alert" className="rounded-ctl border border-negative-line bg-negative-tint px-3 py-2 text-xs text-negative-ink">
            {error}
          </p>
        ) : (
          <Field label="Assign to">
            {({ id }) => (
              <Select
                id={id}
                value={selectedUserId ?? ''}
                onChange={(e) => handleAssignmentChange(e.target.value || null)}
                disabled={isPending}
              >
                <option value="">Unassign</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name} ({profile.role})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {error && profiles.length > 0 ? (
          <p role="alert" className="rounded-ctl border border-negative-line bg-negative-tint px-3 py-2 text-xs text-negative-ink">
            {error}
          </p>
        ) : null}

        {isPending ? <p className="text-xs text-ink-soft">Updating assignment...</p> : null}
      </div>
    </Card>
  );
}
