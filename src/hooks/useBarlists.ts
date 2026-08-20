import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import type { Barlist } from "@/lib/barlistService";
import { fetchBarlists } from "@/lib/barlistService";

export function useBarlists(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["barlists", projectId],
    enabled: !!user,
    queryFn: () => fetchBarlists(projectId),
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`barlists-live-${user?.id || "global"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "barlists" },
        () => queryClient.invalidateQueries({ queryKey: ["barlists"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return { barlists: data ?? [], isLoading, error };
}
