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
  const [punching, setPunching] = useState(false);

  const myProfile = profiles.find((p) => p.user_id === user?.id);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("time_clock_entries")
      .select("*")
      .gte("clock_in", todayStart.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      const { data: allOpenShifts } = await supabase
        .from("time_clock_entries")
        .select("*")
        .is("clock_out", null);

      const todayIds = new Set((data || []).map((e: any) => e.id));
      const extraOpen = ((allOpenShifts as TimeClockEntry[]) || []).filter(e => !todayIds.has(e.id));
      setAllEntries([...extraOpen, ...(data as TimeClockEntry[])]);
      if (myProfile) {
        const todayMyEntries = data.filter((e: any) => e.profile_id === myProfile.id) as TimeClockEntry[];

        const { data: openShifts } = await supabase
          .from("time_clock_entries")
          .select("*")
          .eq("profile_id", myProfile.id)
          .is("clock_out", null);

        const myTodayIds = new Set(todayMyEntries.map(e => e.id));
        const staleOpen = ((openShifts as TimeClockEntry[]) || []).filter(e => !myTodayIds.has(e.id));
        setEntries([...staleOpen, ...todayMyEntries]);
      }
    }
    setLoading(false);
  }, [user, myProfile]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    const channel = supabase
      .channel(`time-clock-realtime-${user?.id || "global"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_clock_entries" }, () => {
        fetchEntries();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  // activeEntry = most recent open shift (sorted by clock_in desc)
  const activeEntry = entries
    .filter((e) => !e.clock_out)
    .sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime())[0] || undefined;

  const clockIn = async () => {
    if (!myProfile) { toast.error("No profile found"); return; }
    if (punching) return;
    setPunching(true);

    try {
      // Close ALL stale open shifts before clocking in
      await supabase
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString(), notes: "[auto-closed: stale shift]" } as any)
        .eq("profile_id", myProfile.id)
        .is("clock_out", null);

      const { error } = await supabase
        .from("time_clock_entries")
        .insert({ profile_id: myProfile.id } as any);

      if (error) {
        toast.error("Failed to clock in");
      } else {
        toast.success("Clocked in!");
        fetchEntries();
      }
    } finally {
      setPunching(false);
    }
  };

  const clockOut = async () => {
    if (!myProfile) { toast.error("No profile found"); return; }
    if (punching) return;
    setPunching(true);

    try {
      // Close ALL open shifts for this profile (root fix)
      const { error } = await supabase
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString() } as any)
        .eq("profile_id", myProfile.id)
        .is("clock_out", null);

      if (error) toast.error("Failed to clock out");
      else { toast.success("Clocked out!"); fetchEntries(); }
    } finally {
      setPunching(false);
    }
  };

  return {
    entries,
    allEntries,
    activeEntry,
    loading,
    punching,
    clockIn,
    clockOut,
    myProfile,
    profiles,
  };
}
