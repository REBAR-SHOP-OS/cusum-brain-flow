import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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
    // Detect if we're returning from an OAuth redirect (hash contains access_token)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isOAuthCallback = hashParams.has('access_token') || hashParams.has('refresh_token');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // If token refresh failed, clear stale session to stop polling with bad JWT
        if (event === 'TOKEN_REFRESHED' && !session) {
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
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

    // If this is an OAuth callback, let onAuthStateChange handle it —
    // don't call getSession() which may resolve with null before
    // Supabase processes the hash tokens, causing a premature redirect.
    if (isOAuthCallback) {
      // Safety timeout: if onAuthStateChange doesn't fire within 5s, stop loading
      const timeout = setTimeout(() => {
        console.warn('OAuth callback timeout — no auth event received');
        setLoading(false);
      }, 5000);
      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    // Normal flow: check for existing session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session) {
        if (error) {
          console.warn('Session recovery failed, clearing stale auth state:', error.message);
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // Validate token server-side — getSession only reads localStorage
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.warn('Stale JWT detected, clearing session:', userError?.message);
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
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
