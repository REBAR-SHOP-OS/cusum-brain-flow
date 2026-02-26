import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/hooks/useProfiles";
import { toast } from "sonner";

export interface TimeClockEntry {
  id: string;
  profile_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  notes: string | null;
  created_at: string;
}

export function useTimeClock() {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const [entries, setEntries] = useState<TimeClockEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimeClockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const myProfile = profiles.find((p) => p.user_id === user?.id);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch today's entries for all team members
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("time_clock_entries")
      .select("*")
      .gte("clock_in", todayStart.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      setAllEntries(data as TimeClockEntry[]);
      if (myProfile) {
        setEntries(data.filter((e: any) => e.profile_id === myProfile.id) as TimeClockEntry[]);
      }
    }
    setLoading(false);
  }, [user, myProfile]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel(`time-clock-realtime-${user?.id || "global"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_clock_entries" }, () => {
        fetchEntries();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  const activeEntry = entries.find((e) => !e.clock_out);

  const clockIn = async () => {
    if (!myProfile) { toast.error("No profile found"); return; }
    if (activeEntry) { toast.error("Already clocked in"); return; }

    const { error } = await supabase
      .from("time_clock_entries")
      .insert({ profile_id: myProfile.id } as any);

    if (error) toast.error("Failed to clock in");
    else { toast.success("Clocked in!"); fetchEntries(); }
  };

  const clockOut = async () => {
    if (!activeEntry) { toast.error("Not clocked in"); return; }

    const { error } = await supabase
      .from("time_clock_entries")
      .update({ clock_out: new Date().toISOString() } as any)
      .eq("id", activeEntry.id);

    if (error) toast.error("Failed to clock out");
    else { toast.success("Clocked out!"); fetchEntries(); }
  };

  return {
    entries,
    allEntries,
    activeEntry,
    loading,
    clockIn,
    clockOut,
    myProfile,
    profiles,
  };
}
