import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserAccessOverride {
  id: string;
  email: string;
  agents: string[];
  automations: string[];
  menus: string[];
  updated_by: string | null;
  updated_at: string;
}

export function useUserAccessOverrides(email?: string | null) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: override, isLoading } = useQuery({
    queryKey: ["user-access-overrides", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_access_overrides" as any)
        .select("*")
        .eq("email", email!.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: (data as any).id,
        email: (data as any).email,
        agents: (data as any).agents ?? [],
        automations: (data as any).automations ?? [],
        menus: (data as any).menus ?? [],
        updated_by: (data as any).updated_by,
        updated_at: (data as any).updated_at,
      } as UserAccessOverride;
    },
  });

  const saveAgents = useMutation({
    mutationFn: async ({ email, agents, updatedBy }: { email: string; agents: string[]; updatedBy: string }) => {
      const normalized = email.toLowerCase();
      const { data: existing } = await supabase
        .from("user_access_overrides" as any)
        .select("id")
        .eq("email", normalized)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_access_overrides" as any)
          .update({ agents, updated_by: updatedBy, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_access_overrides" as any)
          .insert({ email: normalized, agents, automations: [], menus: [], updated_by: updatedBy, company_id: "rebar" } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-access-overrides"] });
      toast({ title: "✅ Agent access updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const saveAutomations = useMutation({
    mutationFn: async ({ email, automations, updatedBy }: { email: string; automations: string[]; updatedBy: string }) => {
      const normalized = email.toLowerCase();
      const { data: existing } = await supabase
        .from("user_access_overrides" as any)
        .select("id")
        .eq("email", normalized)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_access_overrides" as any)
          .update({ automations, updated_by: updatedBy, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_access_overrides" as any)
          .insert({ email: normalized, agents: [], automations, menus: [], updated_by: updatedBy, company_id: "rebar" } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-access-overrides"] });
      toast({ title: "✅ Automation access updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const saveMenus = useMutation({
    mutationFn: async ({ email, menus, updatedBy }: { email: string; menus: string[]; updatedBy: string }) => {
      const normalized = email.toLowerCase();
      const { data: existing } = await supabase
        .from("user_access_overrides" as any)
        .select("id")
        .eq("email", normalized)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_access_overrides" as any)
          .update({ menus, updated_by: updatedBy, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_access_overrides" as any)
          .insert({ email: normalized, agents: [], automations: [], menus, updated_by: updatedBy, company_id: "rebar" } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-access-overrides"] });
      toast({ title: "✅ Menu access updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  return { override, isLoading, saveAgents, saveAutomations, saveMenus };
}
