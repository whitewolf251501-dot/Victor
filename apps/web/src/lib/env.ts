/**
 * Victor Noctis - Environment Variable Validation
 * System 07: Shared Infrastructure
 *
 * Validates required environment variables at runtime.
 * Never logs or exposes values, only lists names of missing variables.
 */

const REQUIRED_SERVER_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
] as const;

const REQUIRED_PUBLIC_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export interface ValidatedEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GEMINI_API_KEY?: string;
}

export function validateEnv(): ValidatedEnv {
  const isBrowser = typeof window !== 'undefined';
  const missing: string[] = [];

  if (isBrowser) {
    for (const key of REQUIRED_PUBLIC_ENV_VARS) {
      if (!process.env[key] || process.env[key]?.trim() === '') {
        missing.push(key);
      }
    }
  } else {
    for (const key of REQUIRED_SERVER_ENV_VARS) {
      if (!process.env[key] || process.env[key]?.trim() === '') {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Victor Environment Error] Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Ensure these are defined in .env.local without committing secrets.`
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
}
