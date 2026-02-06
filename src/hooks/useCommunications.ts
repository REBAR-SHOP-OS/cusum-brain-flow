import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Communication {
  id: string;
  source: "gmail" | "ringcentral";
  sourceId: string;
  type: "email" | "call" | "sms";
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  subject: string | null;
  preview: string | null;
  status: string | null;
  receivedAt: string;
  threadId: string | null;
  metadata: Record<string, unknown> | null;
}

export function useCommunications(options?: { search?: string }) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("communications")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50);

      if (options?.search) {
        query = query.or(
          `subject.ilike.%${options.search}%,from_address.ilike.%${options.search}%,body_preview.ilike.%${options.search}%`
        );
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const mapped: Communication[] = (data ?? []).map((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        let type: Communication["type"] = "email";
        if (row.source === "ringcentral") {
          type = (meta?.type as string) === "sms" ? "sms" : "call";
        }

        return {
          id: row.id,
          source: row.source as Communication["source"],
          sourceId: row.source_id,
          type,
          direction: (row.direction as Communication["direction"]) ?? "inbound",
          from: row.from_address ?? "",
          to: row.to_address ?? "",
          subject: row.subject,
          preview: row.body_preview,
          status: row.status,
          receivedAt: row.received_at ?? row.created_at,
          threadId: row.thread_id,
          metadata: meta,
        };
      });

      setCommunications(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load communications";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [options?.search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return { communications, loading, error, refresh: load };
}
