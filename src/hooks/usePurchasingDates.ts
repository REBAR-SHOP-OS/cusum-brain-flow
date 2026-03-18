import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ConfirmedListRecord {
  id: string;
  due_date: string;
  confirmed_at: string;
  confirmed_by: string | null;
  snapshot: any[];
}

export function usePurchasingDates() {
  const [dates, setDates] = useState<string[]>([]);
  const [confirmedLists, setConfirmedLists] = useState<ConfirmedListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchDates = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.company_id) { setLoading(false); return; }

    // Fetch confirmed lists (primary source for RECENTS)
    const { data: confirmed, error: confError } = await supabase
      .from("purchasing_confirmed_lists")
      .select("id, due_date, confirmed_at, confirmed_by, snapshot")
      .eq("company_id", profile.company_id)
      .order("confirmed_at", { ascending: false });

    if (confError) {
      console.error("Error fetching confirmed lists:", confError);
    } else if (confirmed) {
      setConfirmedLists(confirmed as unknown as ConfirmedListRecord[]);
      const uniqueDates = [...new Set(confirmed.map((r) => r.due_date as string))];
      setDates(uniqueDates);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDates(); }, [fetchDates]);

  useEffect(() => {
    const channel = supabase
      .channel("purchasing_confirmed_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchasing_confirmed_lists" }, () => {
        fetchDates();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDates]);

  const getConfirmedSnapshot = useCallback((dateStr: string) => {
    return confirmedLists.find((c) => c.due_date === dateStr) || null;
  }, [confirmedLists]);

  return { dates, confirmedLists, loading, getConfirmedSnapshot };
}
