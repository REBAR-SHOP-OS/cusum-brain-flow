import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePipelineBulkActions() {
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const toggleSelection = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const selectAll = useCallback((leadIds: string[]) => {
    setSelectedLeadIds(new Set(leadIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLeadIds(new Set());
  }, []);

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, stage }: { ids: string[]; stage: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ stage })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Moved ${vars.ids.length} lead(s) to ${vars.stage.replace(/_/g, " ")}`);
      clearSelection();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Deleted ${ids.length} lead(s)`);
      clearSelection();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ids, assignedTo }: { ids: string[]; assignedTo: string | null }) => {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: assignedTo })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Assigned ${vars.ids.length} lead(s)`);
      clearSelection();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    selectedLeadIds,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkMove: (stage: string) => bulkMoveMutation.mutate({ ids: Array.from(selectedLeadIds), stage }),
    bulkDelete: () => bulkDeleteMutation.mutate(Array.from(selectedLeadIds)),
    bulkAssign: (assignedTo: string | null) => bulkAssignMutation.mutate({ ids: Array.from(selectedLeadIds), assignedTo }),
    isMoving: bulkMoveMutation.isPending,
    isDeleting: bulkDeleteMutation.isPending,
    hasSelection: selectedLeadIds.size > 0,
    selectionCount: selectedLeadIds.size,
  };
}
