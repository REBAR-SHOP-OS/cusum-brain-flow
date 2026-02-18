import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export const TASK_STATUSES = [
  { key: "todo", label: "To Do", color: "bg-slate-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "review", label: "Review", color: "bg-amber-500" },
  { key: "done", label: "Done", color: "bg-emerald-500" },
  { key: "blocked", label: "Blocked", color: "bg-red-500" },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]["key"];

export function useProjectTasks(projectId?: string) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const tasks = useQuery({
    queryKey: ["project_tasks", companyId, projectId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("project_tasks")
        .select("*, profiles:assigned_to(full_name), projects:project_id(name)")
        .eq("company_id", companyId!)
        .order("sort_order", { ascending: true });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const milestones = useQuery({
    queryKey: ["project_milestones", companyId, projectId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("project_milestones")
        .select("*, projects:project_id(name)")
        .eq("company_id", companyId!)
        .order("target_date", { ascending: true });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const projects = useQuery({
    queryKey: ["projects_list", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: { title: string; project_id?: string; description?: string; priority?: string; assigned_to?: string; start_date?: string; due_date?: string; estimated_hours?: number }) => {
      const { error } = await supabase.from("project_tasks").insert({ ...task, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project_tasks"] }); toast.success("Task created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [k: string]: any }) => {
      if (updates.status === "done") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("project_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project_tasks"] }); },
    onError: (e) => toast.error(e.message),
  });

  const createMilestone = useMutation({
    mutationFn: async (ms: { project_id: string; title: string; target_date: string; description?: string }) => {
      const { error } = await supabase.from("project_milestones").insert({ ...ms, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project_milestones"] }); toast.success("Milestone created"); },
    onError: (e) => toast.error(e.message),
  });

  return {
    tasks: tasks.data ?? [],
    milestones: milestones.data ?? [],
    projects: projects.data ?? [],
    isLoading: tasks.isLoading || milestones.isLoading,
    createTask,
    updateTask,
    createMilestone,
  };
}
