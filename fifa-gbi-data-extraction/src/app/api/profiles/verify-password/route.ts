import { NextResponse } from 'next/server';

import { getAdminServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequestPayload = {
  profileId: string;
  password: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestPayload;

    if (!body.profileId || !body.password) {
      return NextResponse.json(
        { error: 'Profile ID and password are required' },
        { status: 400 },
      );
    }

    const supabase = getAdminServiceClient();

    // Fetch profile with password hash
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, role, password_hash')
      .eq('id', body.profileId)
      .maybeSingle();

    if (fetchError) {
      console.error('[verify-password] Database error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to verify password' },
        { status: 500 },
      );
    }

    if (!profile) {
      // Don't reveal that profile doesn't exist - return generic error
      return NextResponse.json(
        { error: 'Invalid profile or password' },
        { status: 401 },
      );
    }

    // Check if profile has a password set
    if (!profile.password_hash) {
      return NextResponse.json(
        { error: 'Password not set for this profile' },
        { status: 403 },
      );
    }

    // Verify password using the database function
    const { data: verificationResult, error: verifyError } = await supabase.rpc(
      'verify_profile_password',
      {
        profile_id: body.profileId,
        provided_password: body.password,
      },
    );

    if (verifyError) {
      console.error('[verify-password] Verification error:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify password' },
        { status: 500 },
      );
    }

    // If verification returns true, password is valid
    if (verificationResult === true) {
      return NextResponse.json({
        success: true,
        profile: {
          id: profile.id,
          fullName: profile.full_name,
          role: profile.role,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid profile or password' },
      { status: 401 },
    );
  } catch (error) {
    console.error('[verify-password] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 },
    );
  }
}

