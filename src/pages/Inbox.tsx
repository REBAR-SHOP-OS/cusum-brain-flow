import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSelector, AgentType } from "@/components/chat/AgentSelector";
import { ChatThread } from "@/components/chat/ChatThread";
import { CalChatInterface } from "@/components/chat/CalChatInterface";
import { ChatInput, UploadedFile } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { UnifiedInboxList } from "@/components/inbox/UnifiedInboxList";
import { CommunicationViewer } from "@/components/inbox/CommunicationViewer";
import { InboxView } from "@/components/inbox/InboxView";
import { useCommunications, Communication } from "@/hooks/useCommunications";
import { useChatSessions, getAgentName } from "@/hooks/useChatSessions";
import { sendAgentMessage } from "@/lib/agent";
import { Mail, Phone, MessageSquare, Bot, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type InboxTab = "email" | "calls" | "sms" | "agents";

export default function Inbox() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<InboxTab>("email");
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("sales");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);
  const [search, setSearch] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const { createSession, addMessage: saveMessage, getSessionMessages } = useChatSessions();

  const typeFilter = activeTab === "calls" ? "call" : activeTab === "sms" ? "sms" : undefined;
  const { communications, loading, error, sync } = useCommunications({
    search: search || undefined,
    typeFilter: activeTab === "calls" || activeTab === "sms" ? typeFilter : undefined,
  });

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
      {/* Header with Tabs */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          {selectedComm && activeTab !== "email" && activeTab !== "agents" && (
            <Button variant="ghost" size="icon" className="md:hidden mr-1" onClick={() => setSelectedComm(null)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">Inbox</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">AI-managed emails, calls, SMS & agents</p>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as InboxTab); setSelectedComm(null); }}>
          <TabsList className="h-9">
            <TabsTrigger value="email" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calls</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SMS</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agents</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Content */}
      {activeTab === "email" ? (
        // AI-powered unified inbox
        <div className="flex-1 overflow-hidden">
          <InboxView />
        </div>
      ) : activeTab === "agents" ? (
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
      ) : (
        // Calls & SMS tabs
        <div className="flex-1 flex overflow-hidden">
          <div className={`${selectedComm ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-shrink-0 flex-col`}>
            <UnifiedInboxList
              communications={communications}
              loading={loading}
              error={error}
              selectedId={selectedComm?.id}
              onSelect={setSelectedComm}
              onRefresh={sync}
              onSearchChange={setSearch}
            />
          </div>
          <div className={`${selectedComm ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 overflow-hidden`}>
            <CommunicationViewer communication={selectedComm} />
          </div>
        </div>
      )}
    </div>
  );
}
