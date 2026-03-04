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
      // Also fetch all open shifts across all dates/profiles for Team Status
      const { data: allOpenShifts } = await supabase
        .from("time_clock_entries")
        .select("*")
        .is("clock_out", null);

      const todayIds = new Set((data || []).map((e: any) => e.id));
      const extraOpen = ((allOpenShifts as TimeClockEntry[]) || []).filter(e => !todayIds.has(e.id));
      setAllEntries([...extraOpen, ...(data as TimeClockEntry[])]);
      if (myProfile) {
        const todayMyEntries = data.filter((e: any) => e.profile_id === myProfile.id) as TimeClockEntry[];

        // Also fetch any open shift across ALL dates for this user (handles stale shifts from previous days)
        const { data: openShifts } = await supabase
          .from("time_clock_entries")
          .select("*")
          .eq("profile_id", myProfile.id)
          .is("clock_out", null);

        // Merge: add any open shift not already in today's list
        const todayIds = new Set(todayMyEntries.map(e => e.id));
        const staleOpen = ((openShifts as TimeClockEntry[]) || []).filter(e => !todayIds.has(e.id));
        setEntries([...staleOpen, ...todayMyEntries]);
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

    // Auto-close any stale open shifts from previous days before clocking in
    const { data: staleShifts } = await supabase
      .from("time_clock_entries")
      .select("id")
      .eq("profile_id", myProfile.id)
      .is("clock_out", null);

    if (staleShifts && staleShifts.length > 0) {
      await supabase
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString(), notes: "[auto-closed: stale shift from previous session]" } as any)
        .eq("profile_id", myProfile.id)
        .is("clock_out", null);
    }

    const { error } = await supabase
      .from("time_clock_entries")
      .insert({ profile_id: myProfile.id } as any);

    if (error) {
      toast.error("Failed to clock in");
    } else {
      toast.success("Clocked in!");
      fetchEntries();
    }
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
