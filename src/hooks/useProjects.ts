import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import type { Project } from "@/lib/barlistService";
import { fetchProjects } from "@/lib/barlistService";

export function useProjects(companyId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects", companyId],
    enabled: !!user,
    queryFn: () => fetchProjects(companyId),
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" },
        () => queryClient.invalidateQueries({ queryKey: ["projects"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return { projects: data ?? [], isLoading, error };
}
