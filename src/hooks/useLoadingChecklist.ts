import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

interface LoadingChecklistItem {
  id: string;
  cut_plan_item_id: string;
  loaded: boolean;
  photo_path: string | null;
  loaded_by: string | null;
  loaded_at: string | null;
}

export function useLoadingChecklist(cutPlanId: string | null) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const queryKey = ["loading-checklist", cutPlanId];

  const { data: checklistItems = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user && !!companyId && !!cutPlanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loading_checklist" as any)
        .select("*")
        .eq("cut_plan_id", cutPlanId!)
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data || []) as unknown as LoadingChecklistItem[];
    },
  });

  // Initialize checklist rows for all items in a bundle
  const initializeChecklist = async (itemIds: string[]) => {
    if (!companyId || !cutPlanId) return;
    
    // Find which items already have rows
    const existingIds = new Set(checklistItems.map(c => c.cut_plan_item_id));
    const newItems = itemIds.filter(id => !existingIds.has(id));
    
    if (newItems.length === 0) return;

    const rows = newItems.map(itemId => ({
      company_id: companyId,
      cut_plan_id: cutPlanId,
      cut_plan_item_id: itemId,
      loaded: false,
    }));

    const { error } = await supabase
      .from("loading_checklist" as any)
      .insert(rows as any);

    if (error) {
      // Ignore unique constraint violations (already initialized)
      if (!error.message?.includes("duplicate")) {
        toast.error("Failed to initialize checklist");
      }
    }
    queryClient.invalidateQueries({ queryKey });
  };

  // Toggle loaded status
  const toggleLoaded = useMutation({
    mutationFn: async ({ itemId, loaded }: { itemId: string; loaded: boolean }) => {
      if (!companyId || !cutPlanId) throw new Error("Missing context");

      // Upsert: create if not exists, update if exists
      const { error } = await supabase
        .from("loading_checklist" as any)
        .upsert({
          company_id: companyId,
          cut_plan_id: cutPlanId,
          cut_plan_item_id: itemId,
          loaded,
          loaded_by: loaded ? user?.id : null,
          loaded_at: loaded ? new Date().toISOString() : null,
        } as any, { onConflict: "cut_plan_id,cut_plan_item_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update");
    },
  });

  // Upload photo evidence
  const uploadPhoto = async (itemId: string, file: File) => {
    if (!companyId || !cutPlanId) return;

    const path = `loading/${cutPlanId}/${itemId}-${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("clearance-photos")
      .upload(path, file);

    if (uploadErr) {
      toast.error("Photo upload failed");
      return;
    }

    const { error } = await supabase
      .from("loading_checklist" as any)
      .upsert({
        company_id: companyId,
        cut_plan_id: cutPlanId,
        cut_plan_item_id: itemId,
        photo_path: path,
        loaded: true,
        loaded_by: user?.id,
        loaded_at: new Date().toISOString(),
      } as any, { onConflict: "cut_plan_id,cut_plan_item_id" });

    if (error) {
      toast.error("Failed to save photo reference");
      return;
    }

    queryClient.invalidateQueries({ queryKey });
    toast.success("Photo evidence saved");
  };

  // Build a lookup map
  const checklistMap = new Map<string, LoadingChecklistItem>();
  for (const item of checklistItems) {
    checklistMap.set(item.cut_plan_item_id, item);
  }

  const loadedCount = checklistItems.filter(c => c.loaded).length;
  const photoCount = checklistItems.filter(c => c.loaded && !!c.photo_path).length;

  return {
    checklistItems,
    checklistMap,
    loadedCount,
    photoCount,
    isLoading,
    initializeChecklist,
    toggleLoaded,
    uploadPhoto,
  };
}
