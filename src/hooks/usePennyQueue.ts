import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { getErrorMessage } from "@/lib/utils";

export interface PennyQueueItem {
  id: string;
  company_id: string;
  invoice_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  days_overdue: number;
  action_type: "email_reminder" | "call_collection" | "send_invoice" | "escalate";
  action_payload: Record<string, unknown>;
  status: "pending_approval" | "approved" | "executed" | "rejected" | "failed";
  priority: "low" | "medium" | "high" | "critical";
  ai_reasoning: string | null;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  followup_date: string | null;
  followup_count: number;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function usePennyQueue() {
  const [items, setItems] = useState<PennyQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();
  const { companyId } = useCompanyId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("penny_collection_queue")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Recalculate days_overdue dynamically based on time since creation
      const now = new Date();
      const recalculated = ((data as unknown as PennyQueueItem[]) || []).map(item => {
        const createdAt = new Date(item.created_at);
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
        return { ...item, days_overdue: item.days_overdue + daysSinceCreation };
      });
      setItems(recalculated);
    } catch (err) {
      console.error("Failed to load penny queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    load();
    const channel = supabase
      .channel("penny-queue-changes-" + Math.random().toString(36).slice(2, 8))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "penny_collection_queue",
        ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
      }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, companyId]);

  const pendingItems = items.filter(i => i.status === "pending_approval")
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const pendingCount = pendingItems.length;

  const approve = useCallback(async (id: string, modifiedPayload?: Record<string, unknown>) => {
    try {
      const updates: Record<string, unknown> = {
        status: "approved",
        approved_at: new Date().toISOString(),
      };
      if (modifiedPayload) updates.action_payload = modifiedPayload;

      const { error } = await supabase
        .from("penny_collection_queue")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Trigger execution
      await supabase.functions.invoke("penny-execute-action", { body: { action_id: id } });
      toast({ title: "✅ Action approved & executing" });
      await load();
    } catch (err) {
      toast({ title: "Approval failed", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [toast]);

  const reject = useCallback(async (id: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from("penny_collection_queue")
        .update({
          status: "rejected",
          execution_result: reason ? { reject_reason: reason } : {},
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Action dismissed" });
      await load();
    } catch (err) {
      toast({ title: "Reject failed", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [toast]);

  const schedule = useCallback(async (id: string, followupDate: string) => {
    try {
      const { error } = await supabase
        .from("penny_collection_queue")
        .update({ followup_date: followupDate, status: "pending_approval" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "📅 Follow-up scheduled", description: followupDate });
      await load();
    } catch (err) {
      toast({ title: "Schedule failed", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [toast]);

  const assign = useCallback(async (id: string, profileId: string) => {
    try {
      const { error } = await supabase
        .from("penny_collection_queue")
        .update({ assigned_to: profileId, assigned_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "👤 Action assigned" });
    } catch (err) {
      toast({ title: "Assign failed", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [toast]);

  const triggerAutoActions = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("penny-auto-actions");
      if (error) throw error;
      toast({ title: "🤖 Penny scanned invoices", description: `${data?.queued || 0} new actions queued` });
    } catch (err) {
      toast({ title: "Auto-scan failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }, [scanning, toast]);

  const totalAtRisk = pendingItems.reduce((s, i) => s + (i.amount || 0), 0);
  const nextFollowup = items
    .filter(i => i.followup_date && i.status === "pending_approval")
    .sort((a, b) => (a.followup_date! > b.followup_date! ? 1 : -1))[0]?.followup_date || null;

  return {
    items, pendingItems, pendingCount, totalAtRisk, nextFollowup,
    loading, scanning, load, approve, reject, schedule, assign, triggerAutoActions,
  };
}

usePennyQueue.displayName = "usePennyQueue";
