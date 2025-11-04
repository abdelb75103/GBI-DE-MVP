import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAdminServiceClient } from '@/lib/supabase';
import type { UserRole } from '@/lib/supabase';

const COOKIE_NAME = 'gbi_active_profile';

type RequestPayload = {
  profileId?: string | null;
};

type CookiePayload = {
  id: string;
  fullName: string;
  role: UserRole;
};

const encodeCookie = (payload: CookiePayload) => Buffer.from(JSON.stringify(payload)).toString('base64url');

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestPayload;
  const response = NextResponse.json({ ok: true });
  const store = cookies();

  if (!body.profileId) {
    store.delete(COOKIE_NAME);
    return response;
  }

  const supabase = getAdminServiceClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', body.profileId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const payload: CookiePayload = {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
  };

  store.set({
    name: COOKIE_NAME,
    value: encodeCookie(payload),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return NextResponse.json({ profile: payload });
}
