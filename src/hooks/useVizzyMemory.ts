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
  "TIME CLOCK": "timeclock",
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

  const analyzeSystem = async () => {
    const res = await sendAgentMessage(
      "assistant",
      `Perform a full system analysis right now. Scan all data sources available to you and report on EACH of the following departments separately.

For each department, use this exact header format: [SECTION_NAME]
The valid section names are: TIME CLOCK, PRODUCTION, ORDERS, LEADS, ACCOUNTING, EMAIL, CRM

1. [TIME CLOCK]: THIS SECTION IS MANDATORY — do NOT skip even if data seems simple.
   - List EVERY employee and their current status (clocked in / clocked out / not clocked in today)
   - For clocked-in employees: name, clock-in time, hours worked so far
   - For clocked-out employees: name, clock-in time, clock-out time, total hours worked
   - For employees not clocked in today: name, mark as "Not clocked in"
   - Total staff currently on site
   - Total hours worked across all team members today
   - Any anomalies: missed punches, overtime (>8h), late arrivals (after 7:30 AM)
2. [PRODUCTION]: Machine status, completed pieces today, active cut plans, targets vs actuals
3. [ORDERS]: Today's work orders, pending orders, overdue items
4. [LEADS]: New leads, stalled leads, pipeline status, follow-ups needed
5. [ACCOUNTING]: Receivables, payables, overdue invoices, cash position
6. [EMAIL]: Unanswered inbound emails, important messages requiring attention
7. [CRM]: Customer activity, recent interactions, follow-ups needed

Rules:
- Each insight must be on its own line prefixed with '• '
- Be concise and actionable
- Focus on what needs attention TODAY
- CRITICAL: Only report facts you can confirm from the provided context
- Do NOT fabricate numbers, names, percentages, or events
- If data is unavailable for a department, write: • Data not available for this section
- Always include the [SECTION_NAME] header even if no data is available`,
      [],
      { companyId }
    );

    if (!res.reply) throw new Error("No response from analysis");

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId || !companyId) throw new Error("Missing user/company");

    // Parse sections from AI response
    const sectionRegex = /\[([A-Z\s]+)\]/g;
    const sections: { category: string; lines: string[] }[] = [];
    const rawLines = res.reply.split("\n");

    let currentCategory = "brain_insight";
    let currentLines: string[] = [];

    for (const line of rawLines) {
      const headerMatch = line.match(/\[([A-Z\s]+)\]/);
      if (headerMatch) {
        // Save previous section
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
    // Push last section
    if (currentLines.length > 0) {
      sections.push({ category: currentCategory, lines: currentLines });
    }

    // Build inserts
    const inserts: { company_id: string; user_id: string; category: string; content: string }[] = [];
    for (const section of sections) {
      for (const content of section.lines) {
        if (content && !content.toLowerCase().includes("data not available")) {
          inserts.push({
            company_id: companyId,
            user_id: userId,
            category: section.category,
            content,
          });
        }
      }
    }

    // Fallback if no structured sections found
    if (inserts.length === 0) {
      const fallbackLines = rawLines
        .map((l) => l.trim())
        .filter((l) => l.startsWith("•") || l.startsWith("-") || l.startsWith("*"));

      if (fallbackLines.length > 0) {
        for (const line of fallbackLines) {
          inserts.push({
            company_id: companyId,
            user_id: userId,
            category: "brain_insight",
            content: line.replace(/^[•\-*]\s*/, ""),
          });
        }
      } else {
        inserts.push({
          company_id: companyId,
          user_id: userId,
          category: "brain_insight",
          content: res.reply,
        });
      }
    }

    const { error } = await supabase.from("vizzy_memory").insert(inserts);
    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    return inserts.length;
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
