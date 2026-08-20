import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function GlassesCaptureHistory() {
  const queryClient = useQueryClient();

  const { data: captures, isLoading } = useQuery({
    queryKey: ["glasses-captures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("glasses_captures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("glasses-captures-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "glasses_captures" }, () => {
        queryClient.invalidateQueries({ queryKey: ["glasses-captures"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!captures?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No captures yet. Take your first photo!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {captures.map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-start gap-3">
            {c.image_url ? (
              <img
                src={c.image_url}
                alt="Capture"
                className="w-16 h-16 rounded-md object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Eye className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase">
                  {c.source}
                </span>
              </p>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                {c.analysis}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
