import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

export interface ScheduledActivity {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  activity_type: string;
  summary: string;
  note: string | null;
  due_date: string;
  assigned_to: string | null;
  assigned_name: string | null;
  created_by: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateActivityInput {
  entity_type: string;
  entity_id: string;
  activity_type: string;
  summary: string;
  note?: string;
  due_date: string;
  assigned_name?: string;
}

export function useScheduledActivities(entityType: string, entityId: string | null) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["scheduled-activities", entityType, entityId];

  const { data: activities = [], isLoading } = useQuery({
    queryKey,
    enabled: !!entityId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_activities")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as ScheduledActivity[];
    },
  });

  const createActivity = useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("scheduled_activities").insert({
        company_id: companyId,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        activity_type: input.activity_type,
        summary: input.summary,
        note: input.note || null,
        due_date: input.due_date,
        assigned_to: user.id,
        assigned_name: input.assigned_name || null,
        created_by: user.id,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Activity scheduled" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markDone = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from("scheduled_activities")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Activity completed" });
    },
  });

  const cancelActivity = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from("scheduled_activities")
        .update({ status: "cancelled" })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Activity cancelled" });
    },
  });

  const planned = activities.filter((a) => a.status === "planned");
  const done = activities.filter((a) => a.status === "done");

  return {
    activities,
    planned,
    done,
    isLoading,
    createActivity,
    markDone,
    cancelActivity,
  };
}
