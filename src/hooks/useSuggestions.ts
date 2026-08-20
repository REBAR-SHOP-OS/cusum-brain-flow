import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Suggestion {
  id: string;
  suggestion_type: string;
  category: string;
  title: string;
  description: string | null;
  priority: number;
  context: Record<string, unknown>;
  status: string;
  created_at: string;
}

export function useSuggestions(category?: string) {
  const { user } = useAuth();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggestions", category],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("suggestions")
        .select("*")
        .in("status", ["pending", "shown"])
        .order("priority", { ascending: false })
        .limit(20);

      if (category) {
        q = q.eq("category", category);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Suggestion[];
    },
    refetchInterval: 30_000,
  });

  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "shown") {
        updates.shown_to = user?.id;
        updates.shown_at = new Date().toISOString();
      }
      if (status === "accepted" || status === "dismissed" || status === "ignored") {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("suggestions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
  });

  const warnings = suggestions.filter((s) => s.suggestion_type === "warning");
  const actions = suggestions.filter((s) => s.suggestion_type === "next_action");
  const learnings = suggestions.filter((s) => s.suggestion_type === "learning");
  const optimizations = suggestions.filter((s) => s.suggestion_type === "optimization");

  return {
    suggestions,
    warnings,
    actions,
    learnings,
    optimizations,
    isLoading,
    acceptSuggestion: (id: string) => updateStatus.mutate({ id, status: "accepted" }),
    dismissSuggestion: (id: string) => updateStatus.mutate({ id, status: "dismissed" }),
    markShown: (id: string) => updateStatus.mutate({ id, status: "shown" }),
  };
}
