import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a browser-side Supabase client.
 * Uses only public environment variables.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[Victor Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in browser context.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
