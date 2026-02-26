import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface RCPresenceEntry {
  user_id: string;
  status: string;
  dnd_status: string | null;
  telephony_status: string | null;
  message: string | null;
  updated_at: string;
}

export function useRCPresence() {
  const { companyId } = useCompanyId();
  const [presenceMap, setPresenceMap] = useState<Map<string, RCPresenceEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchPresence = useCallback(async () => {
    setLoading(true);
    try {
      // Trigger edge function to refresh presence data
      await supabase.functions.invoke("ringcentral-presence", { body: {} });

      // Read from rc_presence table
      const { data } = await supabase
        .from("rc_presence")
        .select("*");

      if (data) {
        const map = new Map<string, RCPresenceEntry>();
        for (const row of data) {
          map.set(row.user_id, {
            user_id: row.user_id,
            status: row.status,
            dnd_status: row.dnd_status,
            telephony_status: row.telephony_status,
            message: row.message,
            updated_at: row.updated_at,
          });
        }
        setPresenceMap(map);
      }
    } catch (err) {
      console.error("Presence fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + poll every 30s
  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("rc_presence_changes-" + Math.random().toString(36).slice(2, 8))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "rc_presence",
        ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
      }, (payload) => {
        const row = payload.new as any;
        if (row?.user_id) {
          setPresenceMap((prev) => {
            const next = new Map(prev);
            next.set(row.user_id, {
              user_id: row.user_id,
              status: row.status,
              dnd_status: row.dnd_status,
              telephony_status: row.telephony_status,
              message: row.message,
              updated_at: row.updated_at,
            });
            return next;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  const getPresence = useCallback((userId: string) => presenceMap.get(userId), [presenceMap]);

  return { presenceMap, getPresence, loading, refresh: fetchPresence };
}
