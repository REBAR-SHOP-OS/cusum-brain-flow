import { useState, useEffect, useCallback, useRef } from "react";
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
  source: string | null;
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
  // Use a ref so fetchEntries always sees the latest myProfile without re-creating
  const myProfileRef = useRef(myProfile);
  myProfileRef.current = myProfile;

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .gte("clock_in", todayStart.toISOString())
        .order("clock_in", { ascending: false });

      if (error) {
        console.error("[TimeClock] fetchEntries today error:", error);
        setLoading(false);
        return;
      }

      // Also fetch ALL open shifts (regardless of date) for team status
      const { data: allOpenShifts, error: openErr } = await supabase
        .from("time_clock_entries")
        .select("*")
        .is("clock_out", null);

      if (openErr) {
        console.error("[TimeClock] fetchEntries open shifts error:", openErr);
      }

      const todayIds = new Set((data || []).map((e: any) => e.id));
      const extraOpen = ((allOpenShifts as TimeClockEntry[]) || []).filter(e => !todayIds.has(e.id));
      setAllEntries([...extraOpen, ...(data as TimeClockEntry[])]);

      const profile = myProfileRef.current;
      if (profile) {
        const todayMyEntries = (data || []).filter((e: any) => e.profile_id === profile.id) as TimeClockEntry[];

        const { data: openShifts } = await supabase
          .from("time_clock_entries")
          .select("*")
          .eq("profile_id", profile.id)
          .is("clock_out", null);

        const myTodayIds = new Set(todayMyEntries.map(e => e.id));
        const staleOpen = ((openShifts as TimeClockEntry[]) || []).filter(e => !myTodayIds.has(e.id));
        setEntries([...staleOpen, ...todayMyEntries]);
      }
    } catch (err) {
      console.error("[TimeClock] fetchEntries exception:", err);
    }
    setLoading(false);
  }, [user]); // Only depends on user, not myProfile

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Re-fetch when myProfile first becomes available
  useEffect(() => {
    if (myProfile) {
      fetchEntries();
    }
  }, [myProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Frontend guard: 6 AM ET for all users (backend trigger is the real enforcer)
    const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" }));
    if (nowET.getHours() < 6) {
      toast.error("Clock-in is only available from 6:00 AM ET");
      return;
    }

    setPunching(true);

    try {
      // Close ALL stale open shifts before clocking in
      const { error: closeErr } = await supabase
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString(), notes: "[auto-closed: stale shift]" } as any)
        .eq("profile_id", myProfile.id)
        .is("clock_out", null);

      if (closeErr) {
        console.error("[TimeClock] clockIn close stale error:", closeErr);
      }

      console.log("[TimeClock] clockIn attempt", { profileId: myProfile.id, userId: user?.id });

      const { error } = await supabase
        .from("time_clock_entries")
        .insert({ profile_id: myProfile.id } as any);

      if (error) {
        console.error("[TimeClock] clockIn insert error:", error);
        toast.error("Failed to clock in: " + error.message);
      } else {
        await supabase.from("profiles").update({ is_active: true } as any).eq("id", myProfile.id);
        toast.success("Clocked in!");
      }
      await fetchEntries();
    } catch (err: any) {
      console.error("[TimeClock] clockIn exception:", err);
      toast.error("Failed to clock in: " + (err?.message || "unknown error"));
    } finally {
      setPunching(false);
    }
  };

  const clockOut = async () => {
    if (!myProfile) { toast.error("No profile found"); return; }
    if (punching) return;
    setPunching(true);

    // Optimistic: mark ALL open entries as closed immediately
    setEntries(prev => prev.map(e =>
      e.clock_out ? e : { ...e, clock_out: new Date().toISOString() }
    ));
    setAllEntries(prev => prev.map(e =>
      e.profile_id === myProfile.id && !e.clock_out
        ? { ...e, clock_out: new Date().toISOString() }
        : e
    ));

    try {
      // Close ALL open shifts for this profile
      const { error } = await supabase
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString() } as any)
        .eq("profile_id", myProfile.id)
        .is("clock_out", null);

      if (error) {
        console.error("[TimeClock] clockOut error:", error);
        toast.error("Failed to clock out");
        // Revert optimistic update on failure
        await fetchEntries();
      } else {
        // Set profile inactive
        await supabase.from("profiles").update({ is_active: false } as any).eq("id", myProfile.id);
        toast.success("Clocked out!");
        // Confirm from DB
        await fetchEntries();
      }
    } catch (err) {
      console.error("[TimeClock] clockOut exception:", err);
      toast.error("Failed to clock out");
      await fetchEntries();
    } finally {
      setPunching(false);
    }
  };

  const adminClockOut = async (profileId: string) => {
    setPunching(true);
    try {
      const { error } = await supabase
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString(), notes: "[admin clock-out]" } as any)
        .eq("profile_id", profileId)
        .is("clock_out", null);

      if (error) {
        console.error("[TimeClock] adminClockOut error:", error);
        toast.error("Failed to clock out user");
      } else {
        await supabase.from("profiles").update({ is_active: false } as any).eq("id", profileId);
        toast.success("User clocked out successfully");
        await fetchEntries();
      }
    } catch (err) {
      console.error("[TimeClock] adminClockOut exception:", err);
      toast.error("Failed to clock out user");
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
    adminClockOut,
    myProfile,
    profiles,
  };
}
