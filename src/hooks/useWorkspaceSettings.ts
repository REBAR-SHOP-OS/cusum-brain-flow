import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WorkspaceSettings {
  id: string;
  timezone: string;
  date_format: string;
  time_format: string;
  updated_at: string;
}

const DEFAULTS: Omit<WorkspaceSettings, "id" | "updated_at"> = {
  timezone: "America/Toronto",
  date_format: "MM/dd/yyyy",
  time_format: "12h",
};

export function useWorkspaceSettings() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["workspace_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[WorkspaceSettings] fetch error:", error);
        return null;
      }
      return data as WorkspaceSettings | null;
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<Omit<WorkspaceSettings, "id" | "updated_at">>) => {
      if (!settings?.id) throw new Error("No workspace settings row found");
      const { error } = await supabase
        .from("workspace_settings")
        .update({ ...patch, updated_at: new Date().toISOString() } as any)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace_settings"] });
      toast.success("Settings saved");
    },
    onError: (err: any) => {
      toast.error("Failed to save settings: " + err.message);
    },
  });

  return {
    timezone: settings?.timezone ?? DEFAULTS.timezone,
    dateFormat: settings?.date_format ?? DEFAULTS.date_format,
    timeFormat: settings?.time_format ?? DEFAULTS.time_format,
    settings,
    isLoading,
    updateSettings,
  };
}
