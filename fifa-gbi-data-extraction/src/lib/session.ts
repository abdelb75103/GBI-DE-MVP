import { cookies } from 'next/headers';

import type { UserRole } from '@/lib/supabase';

const COOKIE_NAME = 'gbi_active_profile';

export type ActiveProfileSession = {
  id: string;
  fullName: string;
  role: UserRole;
};

function decodeCookie(raw: string | undefined): ActiveProfileSession | null {
  if (!raw) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as Partial<ActiveProfileSession>;

    if (!payload?.id || !payload?.role) {
      return null;
    }

    return {
      id: payload.id,
      fullName: payload.fullName ?? '',
      role: payload.role,
    };
  } catch {
    return null;
  }
}

type CookieStore =
  | { get: (name: string) => { value?: string } | undefined }
  | { getAll: () => Array<{ name: string; value: string }> };

export async function readActiveProfileSession(): Promise<ActiveProfileSession | null> {
  let cookieValue: string | undefined;
  try {
    const store = (await cookies()) as unknown as CookieStore | undefined;
    if (store && 'get' in store && typeof store.get === 'function') {
      cookieValue = store.get(COOKIE_NAME)?.value;
    } else if (store && 'getAll' in store && typeof store.getAll === 'function') {
      cookieValue = store.getAll().find((item) => item.name === COOKIE_NAME)?.value;
    }
  } catch {
    cookieValue = process.env.GBI_ACTIVE_PROFILE_OVERRIDE;
  }

  return decodeCookie(cookieValue);
}
