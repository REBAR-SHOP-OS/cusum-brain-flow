import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import type { Barlist, BarlistItem } from "@/lib/barlistService";
import { fetchBarlists, fetchBarlistItems } from "@/lib/barlistService";

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
      .channel("barlists-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "barlists" },
        () => queryClient.invalidateQueries({ queryKey: ["barlists"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return { barlists: data ?? [], isLoading, error };
}

export function useBarlistItems(barlistId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["barlist-items", barlistId],
    enabled: !!user && !!barlistId,
    queryFn: () => fetchBarlistItems(barlistId!),
  });

  useEffect(() => {
    if (!user || !barlistId) return;
    const channel = supabase
      .channel(`barlist-items-${barlistId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "barlist_items" },
        () => queryClient.invalidateQueries({ queryKey: ["barlist-items", barlistId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, barlistId, queryClient]);

  return { items: data ?? [], isLoading, error };
}
