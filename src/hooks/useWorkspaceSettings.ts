import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

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
  const { companyId, isLoading: companyLoading } = useCompanyId();
  const settingsQueryKey = ["workspace_settings", companyId];

  const { data: settings, isLoading } = useQuery({
    queryKey: settingsQueryKey,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_settings")
        .select("*")
        .eq("company_id", companyId)
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
      if (!companyId) throw new Error("No company found");
      const payload = {
        ...patch,
        updated_at: new Date().toISOString(),
        company_id: companyId,
      };
      const { error } = await supabase
        .from("workspace_settings")
        .upsert(payload as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsQueryKey });
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
    isLoading: isLoading || companyLoading,
    updateSettings,
  };
}
