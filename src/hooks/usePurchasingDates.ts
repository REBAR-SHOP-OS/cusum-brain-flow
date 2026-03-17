import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function usePurchasingDates() {
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchDates = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!profile?.company_id) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("purchasing_list_items" as any)
      .select("due_date")
      .eq("company_id", profile.company_id)
      .not("due_date", "is", null)
      .order("due_date", { ascending: false });

    if (!error && data) {
      const unique = [...new Set((data as any[]).map((r) => r.due_date as string))];
      setDates(unique);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDates(); }, [fetchDates]);

  useEffect(() => {
    const channel = supabase
      .channel("purchasing_dates_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchasing_list_items" }, () => {
        fetchDates();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDates]);

  return { dates, loading };
}
