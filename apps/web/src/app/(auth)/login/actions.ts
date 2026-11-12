'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<AuthActionResult> {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }
  } catch (err: unknown) {
    // Next.js redirect throws a NEXT_REDIRECT exception internally which should not be caught as an error
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    return { success: false, error: 'Authentication failed. Please verify credentials.' };
  }

  redirect('/');
}

export async function loginWithMagicLink(email: string): Promise<AuthActionResult> {
  if (!email) {
    return { success: false, error: 'Email address is required.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Magic link dispatched to your email address.',
    };
  } catch {
    return { success: false, error: 'Failed to dispatch magic link. Please try again.' };
  }
}

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Continue redirect regardless
  }
  redirect('/login');
}
