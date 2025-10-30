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

export function readActiveProfileSession(): ActiveProfileSession | null {
  let cookieValue: string | undefined;
  try {
    const store = cookies();
    if (store && typeof (store as unknown as { get?: unknown }).get === 'function') {
      const cookie = (store as unknown as { get: (name: string) => { value?: string } | undefined }).get(COOKIE_NAME);
      cookieValue = cookie?.value;
    } else if (store && typeof (store as unknown as { getAll?: () => Array<{ name: string; value: string }> }).getAll === 'function') {
      const match = (store as unknown as { getAll: () => Array<{ name: string; value: string }> })
        .getAll()
        .find((item) => item.name === COOKIE_NAME);
      cookieValue = match?.value;
    }
  } catch {
    cookieValue = process.env.GBI_ACTIVE_PROFILE_OVERRIDE;
  }

  return decodeCookie(cookieValue);
}
