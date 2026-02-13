import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

const USER_ACTION_PATTERNS: { pattern: string; guidance: string }[] = [
  { pattern: "auth", guidance: "Try logging out and back in." },
  { pattern: "login", guidance: "Try logging out and back in." },
  { pattern: "session", guidance: "Your session may have expired — please re-login." },
  { pattern: "token", guidance: "Your session may have expired — please re-login." },
  { pattern: "permission", guidance: "You may need updated permissions — contact your admin." },
  { pattern: "storage", guidance: "Try clearing your browser cache and refreshing." },
  { pattern: "cache", guidance: "Try clearing your browser cache and refreshing." },
];

function getActionableGuidance(description: string): string | null {
  const lower = description.toLowerCase();
  for (const { pattern, guidance } of USER_ACTION_PATTERNS) {
    if (lower.includes(pattern)) return guidance;
  }
  return null;
}

/**
 * Background monitor that polls vizzy_fix_requests for the current user.
 * Shows toast guidance if the user can take action to resolve an issue.
 * Code-level bugs stay in CEO queue only.
 */
export function useFixRequestMonitor() {
  const { user } = useAuth();
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      try {
        const { data } = await supabase
          .from("vizzy_fix_requests" as any)
          .select("id, description, affected_area")
          .eq("user_id", user.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!data) return;

        for (const req of data as any[]) {
          if (notifiedIds.current.has(req.id)) continue;

          const guidance = getActionableGuidance(req.description);
          if (guidance) {
            notifiedIds.current.add(req.id);
            toast.info("Vizzy noticed an issue", {
              description: guidance,
              duration: 8000,
            });
            break; // only show one toast per check
          }
        }
      } catch {
        // Fail silently
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);
}
