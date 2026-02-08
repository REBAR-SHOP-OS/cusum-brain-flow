import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AgentSelector, AgentType } from "@/components/chat/AgentSelector";
import { ChatThread } from "@/components/chat/ChatThread";
import { CalChatInterface } from "@/components/chat/CalChatInterface";
import { ChatInput, UploadedFile } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { InboxView } from "@/components/inbox/InboxView";
import { useChatSessions, getAgentName } from "@/hooks/useChatSessions";
import { sendAgentMessage } from "@/lib/agent";
import { useRingCentralWidget } from "@/hooks/useRingCentralWidget";
import { Bot, Inbox as InboxIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InboxTab = "inbox" | "agents";

export default function Inbox() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<InboxTab>("inbox");
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("sales");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const { createSession, addMessage: saveMessage, getSessionMessages } = useChatSessions();

  // Load RC Embeddable dial pad widget
  useRingCentralWidget();

  // Handle loading a session from History panel
  useEffect(() => {
    const sessionId = (location.state as any)?.sessionId;
    if (sessionId) {
      setActiveTab("agents");
      loadSession(sessionId);
    }
  }, [location.state]);

  const loadSession = useCallback(async (sessionId: string) => {
    const msgs = await getSessionMessages(sessionId);
    const loaded: Message[] = msgs.map((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "agent",
      content: m.content,
      agent: m.agent_type as AgentType | undefined,
      timestamp: new Date(m.created_at),
      status: "sent" as const,
    }));
    setMessages(loaded);
    setCurrentSessionId(sessionId);

    const agentMsg = msgs.find((m) => m.agent_type);
    if (agentMsg?.agent_type) {
      setSelectedAgent(agentMsg.agent_type as AgentType);
    }
  }, [getSessionMessages]);

  const handleSend = useCallback(async (content: string, files?: UploadedFile[]) => {
    let messageContent = content;
    if (files && files.length > 0) {
      const filesList = files.map(f => `- ${f.name} (${f.url})`).join('\n');
      messageContent = content
        ? `${content}\n\n📎 Attached files:\n${filesList}`
        : `📎 Attached files:\n${filesList}`;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      status: "sent",
      files: files,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      const title = content.slice(0, 80) || "New conversation";
      const agentName = getAgentName(selectedAgent);
      sessionId = await createSession(title, agentName);
      setCurrentSessionId(sessionId);
    }

    if (sessionId) {
      saveMessage(sessionId, "user", messageContent);
    }

    try {
      const history = messages.map((m) => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      }));

      const contextData = files && files.length > 0 ? {
        uploadedFiles: files.map(f => ({ name: f.name, type: f.type, url: f.url }))
      } : undefined;

      const attachedFiles = files && files.length > 0
        ? files.map(f => ({ name: f.name, url: f.url }))
        : undefined;

      const response = await sendAgentMessage(selectedAgent, messageContent, history, contextData, attachedFiles);

      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: response.reply,
        agent: selectedAgent,
        timestamp: new Date(),
        status: content.toLowerCase().includes("draft") ? "draft" : "sent",
      };
      setMessages((prev) => [...prev, agentMessage]);

      if (sessionId) {
        saveMessage(sessionId, "agent", response.reply, selectedAgent);
      }
    } catch (error) {
      console.error("Agent error:", error);
      toast({
        title: "Agent error",
        description: error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  }, [selectedAgent, messages, toast, currentSessionId, createSession, saveMessage]);

  const handleAgentChange = (agent: AgentType) => {
    setSelectedAgent(agent);
    setMessages([]);
    setCurrentSessionId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Minimal header with tab toggle */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-border shrink-0">
        <h1 className="text-base font-semibold">Inbox</h1>
        <div className="flex items-center border border-border rounded-md overflow-hidden bg-muted/50">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1 text-[11px] rounded-none h-7 px-2.5",
              activeTab === "inbox" && "bg-background shadow-sm text-foreground"
            )}
            onClick={() => setActiveTab("inbox")}
          >
            <InboxIcon className="w-3 h-3" />
            Inbox
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1 text-[11px] rounded-none h-7 px-2.5",
              activeTab === "agents" && "bg-background shadow-sm text-foreground"
            )}
            onClick={() => setActiveTab("agents")}
          >
            <Bot className="w-3 h-3" />
            Agents
          </Button>
        </div>
      </header>

      {/* Content */}
      {activeTab === "inbox" ? (
        <div className="flex-1 overflow-hidden">
          <InboxView />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <AgentSelector selected={selectedAgent} onSelect={handleAgentChange} />
          {selectedAgent === "estimation" ? (
            <CalChatInterface />
          ) : (
            <>
              <ChatThread messages={messages} />
              {isTyping && (
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse-subtle">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Agent is thinking...
                  </div>
                </div>
              )}
              <ChatInput
                onSend={handleSend}
                placeholder={`Ask ${selectedAgent} agent...`}
                disabled={isTyping}
                showFileUpload={true}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
