import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { sendAgentMessage, AgentType, ChatMessage as AgentChatMessage } from "@/lib/agent";
import { AgentSuggestions } from "@/components/agent/AgentSuggestions";
import { agentSuggestions } from "@/components/agent/agentSuggestionsData";
import { AgentHistorySidebar } from "@/components/agent/AgentHistorySidebar";
import { useChatSessions } from "@/hooks/useChatSessions";
import { cn } from "@/lib/utils";
import { agentConfigs } from "@/components/agent/agentConfigs";

export default function AgentWorkspace() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const config = agentConfigs[agentId || ""] || agentConfigs.sales;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { createSession, addMessage, getSessionMessages } = useChatSessions();
  const hasConversation = messages.length > 0;
  const suggestions = agentSuggestions[agentId || "sales"] || agentSuggestions.sales;

  // Load a session's messages
  const loadSession = useCallback(async (sessionId: string) => {
    const msgs = await getSessionMessages(sessionId);
    setMessages(
      msgs.map((m) => ({
        id: m.id,
        role: m.role as "user" | "agent",
        content: m.content,
        agent: m.agent_type as any,
        timestamp: new Date(m.created_at),
      }))
    );
    setActiveSessionId(sessionId);
  }, [getSessionMessages]);

  // Start a new empty chat
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
  }, []);

  // Auto-send initial message from Quick Actions
  useEffect(() => {
    const state = location.state as { initialMessage?: string } | null;
    if (state?.initialMessage && messages.length === 0 && !isLoading) {
      // Clear the state so it doesn't re-fire on re-render
      window.history.replaceState({}, "");
      handleSend(state.initialMessage);
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleSend = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Create session on first message if none active
    let sessionId = activeSessionId;
    if (!sessionId) {
      const sessionTitle = agentId === "eisenhower"
        ? format(new Date(), "yyyy-MM-dd (EEE, MMM d)")
        : content;
      sessionId = await createSession(sessionTitle, config.name);
      setActiveSessionId(sessionId);
    }

    // Persist user message
    if (sessionId) {
      addMessage(sessionId, "user", content);
    }

    try {
      const history: AgentChatMessage[] = messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

      const response = await sendAgentMessage(config.agentType, content, history);

      // Build reply with created notification badges
      let replyContent = response.reply;
      if (response.createdNotifications && response.createdNotifications.length > 0) {
        const notifSummary = response.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }

      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: replyContent,
        agent: config.agentType as any,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Persist agent message
      if (sessionId) {
        addMessage(sessionId, "agent", response.reply, config.agentType);
      }
    } catch (error) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: `Sorry, I encountered an error. ${error instanceof Error ? error.message : ""}`,
        agent: config.agentType as any,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, config.agentType, config.name, activeSessionId, createSession, addMessage]);

  return (
    <div className="flex h-full">
      {/* History Sidebar - Left */}
      {sidebarOpen && (
        <div className="w-64 border-r border-border flex-shrink-0 animate-fade-in hidden md:flex flex-col">
          <AgentHistorySidebar
            agentId={agentId || "sales"}
            agentName={config.name}
            agentRole={config.role}
            agentImage={config.image}
            activeSessionId={activeSessionId}
            onSelectSession={loadSession}
            onNewChat={handleNewChat}
          />
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden md:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          {!sidebarOpen && (
            <div className="flex items-center gap-2">
              <img src={config.image} alt={config.name} className="w-6 h-6 rounded-full object-cover" />
              <span className="text-sm font-medium">{config.name}</span>
            </div>
          )}
          <div className="flex-1" />
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">thinking...</span>
          )}
        </div>

        {/* Content: hero or conversation */}
        {!hasConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
            <div className="text-center mb-8 px-4">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Hey, it's <span className="text-primary">{config.name}</span>.
              </h1>
              <p className="text-xl sm:text-2xl font-semibold text-foreground mt-1">
                What can I help you with?
              </p>
            </div>

            <div className="w-full max-w-xl px-4 mb-6">
              <ChatInput
                onSend={handleSend}
                placeholder={config.placeholder}
                disabled={isLoading}
                showFileUpload={agentId === "estimating"}
                showSmartMode
              />
            </div>

            <div className="flex justify-center mb-4">
              <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
            </div>

            <AgentSuggestions
              suggestions={suggestions}
              agentName={config.name}
              agentImage={config.image}
              onSelect={handleSend}
            />
          </div>
        ) : (
          <>
            <ChatThread messages={messages} />
            <ChatInput
              onSend={handleSend}
              placeholder={config.placeholder}
              disabled={isLoading}
              showFileUpload={agentId === "estimating"}
              showSmartMode
            />
          </>
        )}
      </div>
    </div>
  );
}
