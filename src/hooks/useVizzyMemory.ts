import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { sendAgentMessage } from "@/lib/agent";
import { useToast } from "@/hooks/use-toast";

export interface VizzyMemoryEntry {
  id: string;
  category: string;
  content: string;
  created_at: string;
  expires_at: string | null;
  metadata: any;
  user_id: string;
  company_id: string;
}

const QUERY_KEY = "vizzy_memory_all";

const SECTION_CATEGORY_MAP: Record<string, string> = {
  "PRODUCTION": "production",
  "ORDERS": "orders",
  "LEADS": "leads",
  "ACCOUNTING": "accounting",
  "EMAIL": "email",
  "CRM": "crm",
};

export function useVizzyMemory() {
  const { companyId, isLoading: isCompanyLoading } = useCompanyId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hasCompanyContext = !!companyId;

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: [QUERY_KEY, companyId],
    enabled: !!companyId,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vizzy_memory")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as VizzyMemoryEntry[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("vizzy_memory")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "✅ ذخیره شد" });
    },
    onError: () => {
      toast({ title: "خطا در ذخیره", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vizzy_memory")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "🗑️ حذف شد" });
    },
    onError: () => {
      toast({ title: "خطا در حذف", variant: "destructive" });
    },
  });

  // Deterministic timeclock snapshot from DB
  const fetchAndStoreTimeclockSnapshot = async (userId: string) => {
    if (!companyId) return 0;

    const todayDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const todayStartIso = new Date(`${todayDate}T00:00:00`).toISOString();

    // Fetch all company profiles
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("company_id", companyId);

    // Fetch today's time clock entries
    const { data: todayEntries } = await supabase
      .from("time_clock_entries")
      .select("id, profile_id, clock_in, clock_out, break_minutes, notes")
      .gte("clock_in", todayStartIso)
      .order("clock_in", { ascending: true });

    // Fetch open shifts
    const { data: openShifts } = await supabase
      .from("time_clock_entries")
      .select("id, profile_id, clock_in, clock_out, break_minutes, notes")
      .is("clock_out", null);

    const profiles = allProfiles || [];
    const entries = todayEntries || [];
    const opens = openShifts || [];
    const profileIds = new Set(profiles.map((p) => p.id));
    const companyEntries = entries.filter((e) => profileIds.has(e.profile_id));
    const companyOpenShifts = opens.filter((e) => profileIds.has(e.profile_id));

    const now = new Date();
    const tcInserts: { company_id: string; user_id: string; category: string; content: string; metadata: any }[] = [];
    let totalOnSite = 0;
    let totalHoursToday = 0;
    const anomalies: string[] = [];

    for (const prof of profiles) {
      const name = prof.full_name || "Unknown";
      const myEntries = companyEntries.filter((e) => e.profile_id === prof.id);
      const myOpenShift = companyOpenShifts.find((e) => e.profile_id === prof.id);

      if (myEntries.length === 0 && !myOpenShift) {
        tcInserts.push({
          user_id: userId, company_id: companyId, category: "timeclock",
          content: `${name} — Not clocked in today`,
          metadata: { report_date: todayDate, source: "timeclock_daily_snapshot", profile_id: prof.id },
        });
        continue;
      }

      let totalMinutes = 0;
      let status = "clocked out";
      let clockInTime = "";
      let clockOutTime = "";

      for (const entry of myEntries) {
        const cin = new Date(entry.clock_in);
        const cout = entry.clock_out ? new Date(entry.clock_out) : now;
        const mins = (cout.getTime() - cin.getTime()) / 60000 - (entry.break_minutes || 0);
        totalMinutes += Math.max(0, mins);
        if (!clockInTime) clockInTime = cin.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (entry.clock_out) clockOutTime = cout.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }

      if (myOpenShift) {
        status = "clocked in";
        totalOnSite++;
        if (!clockInTime) {
          clockInTime = new Date(myOpenShift.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        }
      }

      const hours = Math.round(totalMinutes / 6) / 10;
      totalHoursToday += hours;

      let content = "";
      if (status === "clocked in") {
        content = `${name} — Clocked in at ${clockInTime}, ${hours}h worked so far`;
      } else if (clockOutTime) {
        content = `${name} — Clocked in ${clockInTime}, out ${clockOutTime}, total ${hours}h`;
      } else {
        content = `${name} — ${hours}h worked today`;
      }

      tcInserts.push({
        user_id: userId, company_id: companyId, category: "timeclock", content,
        metadata: { report_date: todayDate, source: "timeclock_daily_snapshot", profile_id: prof.id, hours, status },
      });

      if (hours > 8) anomalies.push(`⚠️ ${name} overtime: ${hours}h`);
    }

    // Summary line
    tcInserts.push({
      user_id: userId, company_id: companyId, category: "timeclock",
      content: `📊 Total staff on site: ${totalOnSite} | Total team hours today: ${Math.round(totalHoursToday * 10) / 10}h`,
      metadata: { report_date: todayDate, source: "timeclock_daily_snapshot", type: "summary" },
    });

    for (const a of anomalies) {
      tcInserts.push({
        user_id: userId, company_id: companyId, category: "timeclock",
        content: a,
        metadata: { report_date: todayDate, source: "timeclock_daily_snapshot", type: "anomaly" },
      });
    }

    // Dedupe: remove today's old timeclock snapshots
    const { data: existingToday } = await supabase
      .from("vizzy_memory")
      .select("id")
      .eq("company_id", companyId)
      .eq("category", "timeclock")
      .gte("created_at", todayStartIso);

    if (existingToday && existingToday.length > 0) {
      await supabase.from("vizzy_memory").delete().in("id", existingToday.map((r) => r.id));
    }

    if (tcInserts.length > 0) {
      await supabase.from("vizzy_memory").insert(tcInserts);
    }

    return tcInserts.length;
  };

  const analyzeSystem = async () => {
    const res = await sendAgentMessage(
      "assistant",
      `Perform a full system analysis right now. Scan all data sources available to you and report on EACH of the following departments separately.

For each department, use this exact header format: [SECTION_NAME]
The valid section names are: PRODUCTION, ORDERS, LEADS, ACCOUNTING, EMAIL, CRM

1. [PRODUCTION]: Machine status, completed pieces today, active cut plans, targets vs actuals
2. [ORDERS]: Today's work orders, pending orders, overdue items
3. [LEADS]: New leads, stalled leads, pipeline status, follow-ups needed
4. [ACCOUNTING]: Receivables, payables, overdue invoices, cash position
5. [EMAIL]: Unanswered inbound emails, important messages requiring attention
6. [CRM]: Customer activity, recent interactions, follow-ups needed

Rules:
- Each insight must be on its own line prefixed with '• '
- Be concise and actionable
- Focus on what needs attention TODAY
- CRITICAL: Only report facts you can confirm from the provided context
- Do NOT fabricate numbers, names, percentages, or events
- If data is unavailable for a department, write: • Data not available for this section
- Always include the [SECTION_NAME] header even if no data is available
- Do NOT include TIME CLOCK — it is handled separately from real database data`,
      [],
      { companyId }
    );

    if (!res.reply) throw new Error("No response from analysis");

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId || !companyId) throw new Error("Missing user/company");

    // Parse sections from AI response (excluding TIME CLOCK which is DB-driven)
    const sections: { category: string; lines: string[] }[] = [];
    const rawLines = res.reply.split("\n");

    let currentCategory = "brain_insight";
    let currentLines: string[] = [];

    for (const line of rawLines) {
      const headerMatch = line.match(/\[([A-Z\s]+)\]/);
      if (headerMatch) {
        if (currentLines.length > 0) {
          sections.push({ category: currentCategory, lines: currentLines });
        }
        const sectionName = headerMatch[1].trim();
        currentCategory = SECTION_CATEGORY_MAP[sectionName] || "brain_insight";
        currentLines = [];
      } else {
        const trimmed = line.trim();
        if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
          currentLines.push(trimmed.replace(/^[•\-*]\s*/, ""));
        }
      }
    }
    if (currentLines.length > 0) {
      sections.push({ category: currentCategory, lines: currentLines });
    }

    // Build inserts (non-timeclock)
    const inserts: { company_id: string; user_id: string; category: string; content: string }[] = [];
    for (const section of sections) {
      for (const content of section.lines) {
        if (content && !content.toLowerCase().includes("data not available")) {
          inserts.push({ company_id: companyId, user_id: userId, category: section.category, content });
        }
      }
    }

    // Fallback
    if (inserts.length === 0) {
      const fallbackLines = rawLines
        .map((l) => l.trim())
        .filter((l) => l.startsWith("•") || l.startsWith("-") || l.startsWith("*"));

      if (fallbackLines.length > 0) {
        for (const line of fallbackLines) {
          inserts.push({ company_id: companyId, user_id: userId, category: "brain_insight", content: line.replace(/^[•\-*]\s*/, "") });
        }
      } else {
        inserts.push({ company_id: companyId, user_id: userId, category: "brain_insight", content: res.reply });
      }
    }

    // Insert AI-driven insights
    const { error: aiErr } = await supabase.from("vizzy_memory").insert(inserts);
    if (aiErr) throw aiErr;

    // Always store deterministic timeclock snapshot from DB
    const tcCount = await fetchAndStoreTimeclockSnapshot(userId);

    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    return inserts.length + tcCount;
  };

  const categories = [...new Set(entries.map((e) => e.category))].sort();

  return {
    entries,
    isLoading,
    error,
    isCompanyLoading,
    hasCompanyContext,
    categories,
    updateEntry: updateMutation.mutate,
    deleteEntry: deleteMutation.mutate,
    analyzeSystem,
  };
}
