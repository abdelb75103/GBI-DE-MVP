import { NextResponse } from 'next/server';

import { getAdminServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Project Lead profile IDs (matching the SQL script)
const PROJECT_LEAD_PROFILES = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Dr. Ben Clarsen',
    role: 'extractor' as const,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    fullName: 'Professor Eamonn Delahunt',
    role: 'extractor' as const,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    fullName: 'Dr. Nicol van Dyk',
    role: 'extractor' as const,
  },
];

export async function POST() {
  try {
    const supabase = getAdminServiceClient();
    const results = [];

    for (const profile of PROJECT_LEAD_PROFILES) {
      // Check if profile already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', profile.id)
        .maybeSingle();

      if (existing) {
        // Update if role is different
        if (existing.role !== profile.role) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: profile.fullName,
              role: profile.role,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          if (updateError) {
            results.push({ profile: profile.fullName, status: 'error', message: updateError.message });
          } else {
            results.push({ profile: profile.fullName, status: 'updated', role: profile.role });
          }
        } else {
          results.push({ profile: profile.fullName, status: 'exists', role: existing.role });
        }
      } else {
        // Try to create the profile
        const { error: insertError } = await supabase.from('profiles').insert({
          id: profile.id,
          full_name: profile.fullName,
          role: profile.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          // If foreign key constraint error, need to create auth.users first
          if (insertError.message.includes('foreign key') || insertError.message.includes('violates foreign key')) {
            results.push({
              profile: profile.fullName,
              status: 'needs_auth_user',
              message: `Profile requires auth.users entry with ID: ${profile.id}. Create it in Supabase Dashboard > Authentication > Users first.`,
            });
          } else {
            results.push({ profile: profile.fullName, status: 'error', message: insertError.message });
          }
        } else {
          results.push({ profile: profile.fullName, status: 'created', role: profile.role });
        }
      }
    }

    const allSuccess = results.every((r) => r.status === 'created' || r.status === 'updated' || r.status === 'exists');
    const hasErrors = results.some((r) => r.status === 'error' || r.status === 'needs_auth_user');

    return NextResponse.json(
      {
        success: allSuccess,
        results,
        message: hasErrors
          ? 'Some profiles need auth.users entries. Check the results for details.'
          : 'All project lead profiles are set up correctly.',
      },
      { status: allSuccess ? 200 : 207 }, // 207 Multi-Status if some succeeded
    );
  } catch (error) {
    console.error('[setup-project-leads] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

