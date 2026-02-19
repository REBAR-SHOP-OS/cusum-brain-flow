import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NotificationPrefs {
  id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  muted_categories: string[];
}

const DEFAULTS: Omit<NotificationPrefs, "id"> = {
  email_enabled: true,
  push_enabled: true,
  sound_enabled: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  muted_categories: [],
};

export function useNotificationPreferences() {
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification_preferences"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationPrefs | null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const upsert = useMutation({
    mutationFn: async (updates: Partial<Omit<NotificationPrefs, "id">>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const profile = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const companyId = profile.data?.company_id;
      if (!companyId) throw new Error("No company found");

      if (prefs?.id) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", prefs.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            company_id: companyId,
            ...DEFAULTS,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification_preferences"] });
      toast.success("Preferences saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const isInQuietHours = (): boolean => {
    if (!prefs?.quiet_hours_start || !prefs?.quiet_hours_end) return false;
    const now = new Date();
    const hhmm = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const start = prefs.quiet_hours_start.slice(0, 5);
    const end = prefs.quiet_hours_end.slice(0, 5);
    if (start <= end) return hhmm >= start && hhmm <= end;
    return hhmm >= start || hhmm <= end;
  };

  const shouldPlaySound = (): boolean => {
    if (prefs && !prefs.sound_enabled) return false;
    return !isInQuietHours();
  };

  return {
    prefs: prefs ?? DEFAULTS as NotificationPrefs,
    isLoading,
    upsert,
    isInQuietHours,
    shouldPlaySound,
  };
}
