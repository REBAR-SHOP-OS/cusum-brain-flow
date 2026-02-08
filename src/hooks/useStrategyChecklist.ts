import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

export function useStrategyChecklist() {
  const queryClient = useQueryClient();

  const { data: completedItems, isLoading } = useQuery({
    queryKey: ["social_strategy_checklist"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("social_strategy_checklist")
        .select("checklist_item_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((row: any) => row.checklist_item_id as string);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const current = completedItems ?? [];
      if (current.includes(itemId)) {
        // Remove
        const { error } = await supabase
          .from("social_strategy_checklist")
          .delete()
          .eq("user_id", user.id)
          .eq("checklist_item_id", itemId);
        if (error) throw error;
      } else {
        // Add
        const { error } = await supabase
          .from("social_strategy_checklist")
          .insert({ user_id: user.id, checklist_item_id: itemId });
        if (error) throw error;
      }
    },
    onMutate: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey: ["social_strategy_checklist"] });
      const previous = queryClient.getQueryData<string[]>(["social_strategy_checklist"]) ?? [];
      const next = previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId];
      queryClient.setQueryData(["social_strategy_checklist"], next);
      return { previous };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["social_strategy_checklist"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["social_strategy_checklist"] });
    },
  });

  const toggleChecklist = useCallback((id: string) => {
    toggleMutation.mutate(id);
  }, [toggleMutation]);

  return {
    completedChecklist: completedItems ?? [],
    isLoading,
    toggleChecklist,
  };
}
