import { useState, useEffect, useCallback, useRef } from "react";
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
  // AI Relay fields
  aiCategory: string | null;
  aiUrgency: string | null;
  aiActionRequired: boolean | null;
  aiActionSummary: string | null;
  aiDraft: string | null;
  aiProcessedAt: string | null;
  aiPriorityData: Record<string, unknown> | null;
  resolvedAt: string | null;
  resolvedSummary: string | null;
}

export function useCommunications(options?: { search?: string; typeFilter?: string }) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Belt-and-suspenders: get the authenticated user's ID client-side.
      // RLS already enforces user_id = auth.uid() server-side, but this
      // explicit filter ensures correctness even if RLS is ever misconfigured.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCommunications([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("communications")
        .select("*")
        .eq("user_id", user.id)   // explicit client-side guard — reads from session, not params
        .order("received_at", { ascending: false })
        .limit(200);

      if (options?.search) {
        query = query.or(
          `subject.ilike.%${options.search}%,from_address.ilike.%${options.search}%,body_preview.ilike.%${options.search}%`
        );
      }

      // Filter by source/type
      if (options?.typeFilter === "email") {
        query = query.eq("source", "gmail");
      } else if (options?.typeFilter === "call") {
        query = query.eq("source", "ringcentral").contains("metadata", { type: "call" });
      } else if (options?.typeFilter === "sms") {
        query = query.eq("source", "ringcentral").contains("metadata", { type: "sms" });
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
          aiCategory: (row as any).ai_category ?? null,
          aiUrgency: (row as any).ai_urgency ?? null,
          aiActionRequired: (row as any).ai_action_required ?? null,
          aiActionSummary: (row as any).ai_action_summary ?? null,
          aiDraft: (row as any).ai_draft ?? null,
          aiProcessedAt: (row as any).ai_processed_at ?? null,
          aiPriorityData: (row as any).ai_priority_data ?? null,
          resolvedAt: (row as any).resolved_at ?? null,
          resolvedSummary: (row as any).resolved_summary ?? null,
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
  }, [options?.search, options?.typeFilter, toast]);

  // Trigger actual sync from Gmail + RingCentral, then reload
  const syncingRef = useRef(false);
  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      // Call both sync edge functions in parallel
      const [gmailRes, rcRes] = await Promise.allSettled([
        supabase.functions.invoke("gmail-sync", { body: { maxResults: 30 } }),
        supabase.functions.invoke("ringcentral-sync", { body: {} }),
      ]);

      const errors: string[] = [];
      const infos: string[] = [];

      // Helper to extract mismatch/not-connected vs real errors
      const handleResult = (res: PromiseSettledResult<{ data: unknown; error: unknown }>, name: string) => {
        if (res.status === "rejected") {
          errors.push(`${name} sync failed`);
          return;
        }
        const { data, error } = res.value as { 
          data: Record<string, unknown> | null; 
          error: { message?: string } | null 
        };
        
        // Check data-level errors (edge functions return error info in data body)
        if (data && typeof data === "object") {
          const errType = String((data as Record<string, unknown>).error || "");
          const msg = String((data as Record<string, unknown>).message || "");
          if (errType.includes("not_connected") || errType.includes("mismatch") || 
              msg.includes("not connected") || msg.includes("mismatch") ||
              errType.includes("gmail_not_connected")) {
            // Silently ignore — user simply hasn't connected this service
            return;
          }
        }

        if (!error) return; // True success
        
        errors.push(`${name}: ${error.message || "sync failed"}`);
      };

      handleResult(gmailRes, "Gmail");
      handleResult(rcRes, "RingCentral");

      if (infos.length > 0 && errors.length === 0) {
        // Only show info if there were no real errors — this is expected for users without connections
        // Don't show toast for "not connected" — the UI banner handles it
      } else if (errors.length > 0) {
        toast({ title: "Sync warnings", description: [...errors, ...infos].join("; "), variant: "destructive" });
      } else {
        toast({ title: "Synced", description: "Emails & calls refreshed" });
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      syncingRef.current = false;
      // Reload from DB after sync
      await load();
    }
  }, [load, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return { communications, loading, error, refresh: load, sync };
}
