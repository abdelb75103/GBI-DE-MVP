'use client';

import { Tag } from '@/components/ui';

/**
 * Who holds a paper is an attribute, not a reviewer decision, so it never takes
 * a state colour. The Status column beside it carries the decision; these stay
 * neutral and are told apart by their label.
 */

type AssignmentStatus = 'available' | 'mine' | 'assigned' | 'duplicate';

type AssignmentBadgeProps = {
  status: AssignmentStatus;
  assigneeName?: string;
};

export function AssignmentBadge({ status, assigneeName }: AssignmentBadgeProps) {
  if (status === 'duplicate') {
    return <Tag>Duplicate</Tag>;
  }

  if (status === 'available') {
    return <Tag>Available</Tag>;
  }

  if (status === 'mine') {
    return <Tag title="Assigned to you">Yours</Tag>;
  }

  const name = assigneeName || 'another user';
  return <Tag title={`Assigned to ${name}`}>Assigned to {name}</Tag>;
}
