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
      "Perform a full system analysis right now. Scan all projects, active orders, production queue, financials, recent emails, CRM leads, team presence, and any anomalies. Return a structured list of key insights, each on its own line prefixed with '• '. Be concise and actionable. Focus on what needs attention TODAY.",
      [],
      { companyId }
    );

    if (!res.reply) throw new Error("No response from analysis");

    const lines = res.reply
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("•") || l.startsWith("-") || l.startsWith("*"));

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId || !companyId) throw new Error("Missing user/company");

    if (lines.length > 0) {
      const inserts = lines.map((line) => ({
        company_id: companyId,
        user_id: userId,
        category: "brain_insight",
        content: line.replace(/^[•\-*]\s*/, ""),
      }));

      const { error } = await supabase.from("vizzy_memory").insert(inserts);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("vizzy_memory").insert({
        company_id: companyId,
        user_id: userId,
        category: "brain_insight",
        content: res.reply,
      });
      if (error) throw error;
    }

    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    return lines.length || 1;
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
