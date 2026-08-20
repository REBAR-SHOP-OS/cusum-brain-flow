import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";

function isEmailAllowed(email: string | undefined): boolean {
  if (!email) return false;
  return ACCESS_POLICIES.allowedLoginEmails.some(
    (e) => e.toLowerCase() === email.toLowerCase(),
  );
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user && !isEmailAllowed(session.user.email)) {
          console.warn("Unauthorized email detected, signing out:", session.user.email);
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Self-heal stale/invalid JWTs (e.g. "invalid claim: missing sub claim" after
    // a signing-key rotation). If the stored session can't be validated, purge
    // local auth storage so the user can sign in cleanly instead of getting
    // stuck on a 403 loop.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { error } = await supabase.auth.getUser();
        if (error) {
          console.warn("Stale session detected, clearing auth storage:", error.message);
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const k = localStorage.key(i);
              if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) {
                localStorage.removeItem(k);
              }
            }
          } catch {}
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      } catch (e) {
        console.warn("Session validation failed:", e);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);


  const signIn = async (email: string, password: string) => {
    if (!isEmailAllowed(email)) {
      return { error: new Error("Access denied — your account is not authorized.") };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Cached session-based user accessor. Use this in hooks/services instead of
 * `supabase.auth.getUser()` — that call hits the Auth server on every
 * invocation and violates the "Session Stability" rule
 * (`mem://auth/session-stability`). Reads from the locally-cached session
 * maintained by `onAuthStateChange`.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const u = await getCurrentUser();
  return u?.id ?? null;
}

