import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export type CallTaskStatus = "queued" | "dialing" | "in_call" | "done" | "failed" | "canceled";
export type CallTaskOutcome = "answered" | "no_answer" | "voicemail" | "wrong_number" | "busy";

export interface CallTask {
  id: string;
  phone: string;
  contact_name: string;
  reason: string;
  details?: string;
  status: CallTaskStatus;
  outcome?: CallTaskOutcome;
  attempt_count: number;
  rc_session_id?: string;
  ai_transcript?: Array<{ role: string; text: string }>;
}

export interface UseCallTaskReturn {
  activeTask: CallTask | null;
  createCallTask: (data: {
    phone: string;
    contact_name: string;
    reason: string;
    details?: string;
    lead_id?: string;
    contact_id?: string;
  }) => Promise<string | null>;
  startCall: (taskId: string) => Promise<void>;
  onCallConnected: (taskId: string, rcSessionId?: string) => Promise<void>;
  completeCall: (taskId: string, outcome: CallTaskOutcome, transcript?: Array<{ role: string; text: string }>) => Promise<void>;
  failCall: (taskId: string, reason?: string) => Promise<void>;
  cancelCall: (taskId: string) => Promise<void>;
  clearTask: () => void;
}

export function useCallTask(): UseCallTaskReturn {
  const [activeTask, setActiveTask] = useState<CallTask | null>(null);
  const { companyId } = useCompanyId();

  const createCallTask = useCallback(async (data: {
    phone: string;
    contact_name: string;
    reason: string;
    details?: string;
    lead_id?: string;
    contact_id?: string;
  }): Promise<string | null> => {
    if (!companyId) {
      toast.error("No company found");
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return null;
    }

    // Check for existing active task to same phone (idempotency)
    const { data: existing } = await supabase
      .from("call_tasks" as any)
      .select("id, status")
      .eq("phone", data.phone)
      .in("status", ["queued", "dialing", "in_call"])
      .maybeSingle();

    if (existing) {
      toast.info("A call to this number is already in progress");
      setActiveTask({
        id: (existing as any).id,
        phone: data.phone,
        contact_name: data.contact_name,
        reason: data.reason,
        details: data.details,
        status: (existing as any).status as CallTaskStatus,
        attempt_count: 0,
      });
      return (existing as any).id;
    }

    const { data: inserted, error } = await supabase
      .from("call_tasks" as any)
      .insert({
        company_id: companyId,
        user_id: user.id,
        phone: data.phone,
        contact_name: data.contact_name,
        reason: data.reason,
        details: data.details || null,
        lead_id: data.lead_id || null,
        contact_id: data.contact_id || null,
        status: "queued",
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create call task:", error);
      toast.error("Failed to create call task");
      return null;
    }

    const taskId = (inserted as any).id;
    setActiveTask({
      id: taskId,
      phone: data.phone,
      contact_name: data.contact_name,
      reason: data.reason,
      details: data.details,
      status: "queued",
      attempt_count: 0,
    });

    return taskId;
  }, [companyId]);

  const startCall = useCallback(async (taskId: string) => {
    const { error } = await supabase
      .from("call_tasks" as any)
      .update({
        status: "dialing",
        attempt_count: (activeTask?.attempt_count ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
      } as any)
      .eq("id", taskId);

    if (error) {
      console.error("Failed to update call task to dialing:", error);
    }

    setActiveTask((t) => t ? { ...t, status: "dialing", attempt_count: t.attempt_count + 1 } : t);
  }, [activeTask]);

  const onCallConnected = useCallback(async (taskId: string, rcSessionId?: string) => {
    const update: any = { status: "in_call" };
    if (rcSessionId) update.rc_session_id = rcSessionId;

    const { error } = await supabase
      .from("call_tasks" as any)
      .update(update)
      .eq("id", taskId);

    if (error) {
      console.error("Failed to update call task to in_call:", error);
    }

    setActiveTask((t) => t ? { ...t, status: "in_call", rc_session_id: rcSessionId } : t);
  }, []);

  const completeCall = useCallback(async (
    taskId: string,
    outcome: CallTaskOutcome,
    transcript?: Array<{ role: string; text: string }>
  ) => {
    const { error } = await supabase
      .from("call_tasks" as any)
      .update({
        status: "done",
        outcome,
        ai_transcript: transcript ? JSON.stringify(transcript) : null,
      } as any)
      .eq("id", taskId);

    if (error) {
      console.error("Failed to complete call task:", error);
    }

    setActiveTask((t) => t ? { ...t, status: "done", outcome, ai_transcript: transcript } : t);
  }, []);

  const failCall = useCallback(async (taskId: string, reason?: string) => {
    const { error } = await supabase
      .from("call_tasks" as any)
      .update({
        status: "failed",
        notes: reason || "Call failed",
      } as any)
      .eq("id", taskId);

    if (error) {
      console.error("Failed to mark call task as failed:", error);
    }

    setActiveTask((t) => t ? { ...t, status: "failed" } : t);
  }, []);

  const cancelCall = useCallback(async (taskId: string) => {
    const { error } = await supabase
      .from("call_tasks" as any)
      .update({ status: "canceled" } as any)
      .eq("id", taskId);

    if (error) {
      console.error("Failed to cancel call task:", error);
    }

    setActiveTask(null);
  }, []);

  const clearTask = useCallback(() => {
    setActiveTask(null);
  }, []);

  return {
    activeTask,
    createCallTask,
    startCall,
    onCallConnected,
    completeCall,
    failCall,
    cancelCall,
    clearTask,
  };
}
