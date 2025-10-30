import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/types';

type SchemaName = 'public';

type ClientOptions = SupabaseClientOptions<SchemaName>;

export function createSupabaseBrowserClient(options?: ClientOptions): SupabaseClient<Database, SchemaName> {
  if (typeof window === 'undefined') {
    throw new Error('createSupabaseBrowserClient must be called in a browser context.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured on the client.');
  }

  return createClient<Database, SchemaName>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    ...options,
  });
}

export function createSupabaseServerClient(
  options?: ClientOptions,
  { useServiceRole }: { useServiceRole?: boolean } = {},
): SupabaseClient<Database, SchemaName> {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseServerClient must be called in a server-side context.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase server environment variables are missing.');
  }

  if (useServiceRole && !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be provided for service role operations.');
  }

  const key = useServiceRole ? serviceRoleKey! : anonKey;

  return createClient<Database, SchemaName>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': useServiceRole ? 'gbi-admin-service' : 'gbi-server',
      },
    },
    ...options,
  });
}

let cachedServiceClient: SupabaseClient<Database, SchemaName> | null = null;

export function getAdminServiceClient(options?: ClientOptions): SupabaseClient<Database, SchemaName> {
  if (typeof window !== 'undefined') {
    throw new Error('getAdminServiceClient must be used server-side to protect the service role key.');
  }

  if (!cachedServiceClient) {
    cachedServiceClient = createSupabaseServerClient(options, { useServiceRole: true });
  }

  return cachedServiceClient;
}
