import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface AdminChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface PendingAction {
  tool: string;
  args: Record<string, any>;
  description: string;
}

const TOOL_LABELS: Record<string, string> = {
  update_machine_status: "Update Machine Status",
  update_delivery_status: "Update Delivery Status",
  update_lead_status: "Update Lead Status",
  update_cut_plan_status: "Update Cut Plan Status",
  create_event: "Log Activity Event",
  wp_update_post: "Update WordPress Post",
  wp_update_page: "Update WordPress Page",
  wp_update_product: "Update WooCommerce Product",
  wp_update_order_status: "Update WooCommerce Order",
  wp_create_redirect: "Create 301 Redirect",
};

export function useAdminChat(currentPage?: string) {
  const [messages, setMessages] = useState<AdminChatEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parseSSEStream = useCallback(async (resp: Response, assistantId: string) => {
    if (!resp.body) return;

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id === assistantId) {
          return prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantSoFar } : m
          );
        }
        return [
          ...prev,
          { id: assistantId, role: "assistant" as const, content: assistantSoFar, timestamp: new Date() },
        ];
      });
    };

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let currentEventType = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        // Handle event type lines
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
          continue;
        }

        if (line.startsWith(":") || line.trim() === "") {
          currentEventType = "";
          continue;
        }
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);

          if (currentEventType === "pending_action") {
            // This is a pending write action needing confirmation
            setPendingAction({
              tool: parsed.tool,
              args: parsed.args,
              description: parsed.description || `Execute ${parsed.tool}`,
            });
            currentEventType = "";
            continue;
          }

          // Normal chat content
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) upsertAssistant(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }

        currentEventType = "";
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith("event: ") || raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) upsertAssistant(content);
        } catch { /* ignore */ }
      }
    }

    if (!assistantSoFar) {
      upsertAssistant("No response from AI.");
    }

    return assistantSoFar;
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isStreaming) return;

    const userEntry: AdminChatEntry = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userEntry]);
    setIsStreaming(true);
    setPendingAction(null);

    const history: ChatMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: input.trim() });

    const assistantId = crypto.randomUUID();

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const headers = await getAuthHeaders();
      if (!headers) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "⚠️ Not authenticated. Please log in.", timestamp: new Date() },
        ]);
        setIsStreaming(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: history, currentPage: currentPage || window.location.pathname }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `⚠️ ${errData.error || "Request failed"}`, timestamp: new Date() },
        ]);
        setIsStreaming(false);
        return;
      }

      await parseSSEStream(resp, assistantId);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `⚠️ Error: ${e.message || "Unknown error"}`, timestamp: new Date() },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, isStreaming, currentPage, getAuthHeaders, parseSSEStream]);

  const confirmAction = useCallback(async () => {
    if (!pendingAction || isStreaming) return;

    const action = pendingAction;
    setPendingAction(null);
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();

    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "⚠️ Not authenticated.", timestamp: new Date() },
        ]);
        setIsStreaming(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ confirm_action: { tool: action.tool, args: action.args } }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Action failed" }));
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `❌ ${errData.error || "Action failed"}`, timestamp: new Date() },
        ]);
        setIsStreaming(false);
        return;
      }

      await parseSSEStream(resp, assistantId);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: `❌ Error: ${e.message || "Unknown"}`, timestamp: new Date() },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [pendingAction, isStreaming, getAuthHeaders, parseSSEStream]);

  const cancelAction = useCallback(() => {
    if (!pendingAction) return;
    const toolLabel = TOOL_LABELS[pendingAction.tool] || pendingAction.tool;
    setPendingAction(null);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: `🚫 Action cancelled: **${toolLabel}**`, timestamp: new Date() },
    ]);
  }, [pendingAction]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingAction(null);
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    pendingAction,
    sendMessage,
    confirmAction,
    cancelAction,
    clearChat,
    cancelStream,
  };
}
