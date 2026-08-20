import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Provides an `ensureSession()` helper that validates the current JWT
 * and attempts a refresh if it's stale. Returns true if session is valid.
 */
export function useSessionGuard() {
  const ensureSession = useCallback(async (): Promise<boolean> => {
    const { error: userError } = await supabase.auth.getUser();
    if (!userError) return true;

    // Token is stale — try refreshing
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) return true;

    // Refresh also failed — force sign out
    console.warn("Session expired, signing out:", refreshError.message);
    toast.error("Session expired — please log in again");
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return false;
  }, []);

  return { ensureSession };
}
