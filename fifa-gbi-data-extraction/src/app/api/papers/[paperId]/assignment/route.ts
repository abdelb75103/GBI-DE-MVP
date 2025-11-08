import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabase/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const profile = await readActiveProfileSession();
  
  // Only admins can reassign papers
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can reassign papers.' },
      { status: 403 }
    );
  }

  const { paperId } = await params;
  const body = (await request.json().catch(() => ({}))) as { assignedTo?: string | null };

  if (body.assignedTo === undefined) {
    return NextResponse.json(
      { error: 'assignedTo field is required (can be null to unassign)' },
      { status: 400 }
    );
  }

  try {
    const paper = await mockDb.getPaper(paperId);
    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    // Update assignment
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from('papers')
      .update({
        assigned_to: body.assignedTo || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paperId);

    if (error) {
      throw new Error(`Failed to update assignment: ${error.message}`);
    }

    // Fetch updated paper with assignee info
    const updatedPaper = await mockDb.getPaper(paperId);
    if (!updatedPaper) {
      return NextResponse.json({ error: 'Paper not found after update' }, { status: 404 });
    }

    return NextResponse.json({ paper: updatedPaper });
  } catch (error) {
    console.error('[PATCH assignment] failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update assignment.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

