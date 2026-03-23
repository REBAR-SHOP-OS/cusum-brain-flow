/**
 * Auth service layer — thin wrapper around Supabase auth.
 * Purely additive. Existing useAuth hook can optionally call these.
 * Provides structured error handling and a single import point.
 */
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthResult<T> {
  data: T | null;
  error: string | null;
}

export async function getCurrentUser(): Promise<AuthResult<User>> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return { data: null, error: error.message };
    return { data: user, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get user" };
  }
}

export async function getCurrentSession(): Promise<AuthResult<Session>> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return { data: null, error: error.message };
    return { data: session, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get session" };
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult<Session>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error: error.message };
    return { data: data.session, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Sign in failed" };
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { data: null, error: error.message };
    return { data: { user: data.user, session: data.session }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Sign up failed" };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err.message ?? "Sign out failed" };
  }
}
