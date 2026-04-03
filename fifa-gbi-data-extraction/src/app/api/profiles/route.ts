import { NextResponse } from 'next/server';

import { canAccessWorkspace, getDisplayRole } from '@/lib/profile-access';
import { readActiveProfileSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabase/clients';
import type { UserRole } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const profile = await readActiveProfileSession();
  
  // Only admins can list all profiles
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can list profiles.' },
      { status: 403 }
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin', 'extractor'] as UserRole[])
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return NextResponse.json({
      profiles: (data ?? [])
        .filter((candidate) => canAccessWorkspace(candidate))
        .map((candidate) => ({
          ...candidate,
          displayRole: getDisplayRole(candidate),
        })),
    });
  } catch (error) {
    console.error('[GET profiles] failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profiles.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
