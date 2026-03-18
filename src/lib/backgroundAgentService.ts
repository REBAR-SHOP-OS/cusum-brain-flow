/**
 * BackgroundAgentService — singleton that keeps agent requests alive
 * even when the user navigates away from the agent page.
 *
 * It persists responses directly to `chat_messages` via Supabase so the
 * result is available when the user returns.
 */

import { supabase } from "@/integrations/supabase/client";
import { sendAgentMessage, type AgentType, type ChatMessage, type AgentResponse, type AttachedFile } from "@/lib/agent";
import { toast } from "sonner";

export interface InFlightRequest {
  sessionId: string;
  agentType: AgentType;
  promise: Promise<AgentResponse>;
  startedAt: number;
}

class BackgroundAgentService {
  private inflight = new Map<string, InFlightRequest>();
  /** Callbacks registered by the currently-mounted component (keyed by sessionId). */
  private listeners = new Map<string, (response: AgentResponse) => void>();
  /** Responses that arrived after the component unmounted, keyed by sessionId. */
  private undelivered = new Map<string, AgentResponse>();

  /**
   * Fire-and-forget: sends the agent message, persists the result to DB,
   * and notifies any mounted listener.  If no listener is present the result
   * is stored in `undelivered` for later retrieval.
   */
  enqueue(
    sessionId: string,
    agentType: AgentType,
    agentName: string,
    message: string,
    history?: ChatMessage[],
    context?: Record<string, unknown>,
    attachedFiles?: AttachedFile[],
    pixelSlot?: number,
    preferredModel?: string,
  ): Promise<AgentResponse> {
    const promise = sendAgentMessage(agentType, message, history, context, attachedFiles, pixelSlot, preferredModel);

    const entry: InFlightRequest = { sessionId, agentType, promise, startedAt: Date.now() };
    this.inflight.set(sessionId, entry);

    // Handle completion (success or failure) in background
    promise
      .then(async (response) => {
        // Persist agent reply to DB
        try {
          await supabase.from("chat_messages").insert({
            session_id: sessionId,
            role: "agent",
            content: response.reply,
            agent_type: agentType,
          });
          await supabase
            .from("chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", sessionId);
        } catch (dbErr) {
          console.error("[BackgroundAgentService] DB persist failed:", dbErr);
        }

        // Deliver to mounted component or store for later
        const listener = this.listeners.get(sessionId);
        if (listener) {
          listener(response);
        } else {
          this.undelivered.set(sessionId, response);
          toast.info(`${agentName} finished processing your request`);
        }
      })
      .catch((err) => {
        console.error("[BackgroundAgentService] Agent error:", err);
        // Persist error as agent message so user sees it
        const errText = err instanceof Error ? err.message : "Unknown error";
        supabase.from("chat_messages").insert({
          session_id: sessionId,
          role: "agent",
          content: `⚠️ ${errText}`,
          agent_type: agentType,
        }).then(() => {});

        const listener = this.listeners.get(sessionId);
        if (listener) {
          listener({ reply: `⚠️ ${errText}` });
        } else {
          this.undelivered.set(sessionId, { reply: `⚠️ ${errText}` });
          toast.error(`${agentName} encountered an error`);
        }
      })
      .finally(() => {
        this.inflight.delete(sessionId);
      });

    return promise;
  }

  /** Register a callback for when a response arrives for this session. */
  subscribe(sessionId: string, cb: (response: AgentResponse) => void) {
    this.listeners.set(sessionId, cb);
  }

  /** Unsubscribe (call on unmount). Does NOT cancel the in-flight request. */
  unsubscribe(sessionId: string) {
    this.listeners.delete(sessionId);
  }

  /** Check if a session has an in-flight request. */
  isProcessing(sessionId: string): boolean {
    return this.inflight.has(sessionId);
  }

  /** Retrieve and clear an undelivered response. */
  consumeUndelivered(sessionId: string): AgentResponse | undefined {
    const r = this.undelivered.get(sessionId);
    if (r) this.undelivered.delete(sessionId);
    return r;
  }
}

/** Singleton instance that outlives component lifecycles. */
export const backgroundAgentService = new BackgroundAgentService();
