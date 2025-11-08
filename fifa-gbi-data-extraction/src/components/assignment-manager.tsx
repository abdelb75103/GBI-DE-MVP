'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Assignment</p>
          <p className="mt-1 text-xs text-slate-500">
            Manage paper assignment. Only visible to administrators.
          </p>
        </div>

        {currentAssigneeName && (
          <div className="rounded-lg bg-slate-50/80 px-3 py-2">
            <p className="text-xs font-medium text-slate-600">Currently assigned to:</p>
            <p className="text-sm font-semibold text-slate-900">{currentAssigneeName}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-xs text-slate-500">Loading users...</div>
        ) : error && !profiles.length ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="assignment-select" className="block text-xs font-medium text-slate-700">
              Assign to:
            </label>
            <select
              id="assignment-select"
              value={selectedUserId ?? ''}
              onChange={(e) => handleAssignmentChange(e.target.value || null)}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Unassign</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name} ({profile.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {error && profiles.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        {isPending && (
          <div className="text-xs text-slate-500">Updating assignment...</div>
        )}
      </div>
    </div>
  );
}

