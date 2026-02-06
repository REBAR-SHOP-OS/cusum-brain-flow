import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSelector, AgentType } from "@/components/chat/AgentSelector";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { UnifiedInboxList } from "@/components/inbox/UnifiedInboxList";
import { CommunicationViewer } from "@/components/inbox/CommunicationViewer";
import { useCommunications, Communication } from "@/hooks/useCommunications";
import { sendAgentMessage } from "@/lib/agent";
import { Mail, Phone, MessageSquare, Bot, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type InboxTab = "email" | "calls" | "sms" | "agents";

export default function Inbox() {
  const [activeTab, setActiveTab] = useState<InboxTab>("email");
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("sales");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const typeFilter = activeTab === "calls" ? "call" : activeTab === "sms" ? "sms" : activeTab === "email" ? "email" : undefined;

  const { communications, loading, error, refresh, sync } = useCommunications({ search: search || undefined, typeFilter });

  const handleSend = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      status: "sent",
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      }));

      const response = await sendAgentMessage(selectedAgent, content, history);
      
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: response.reply,
        agent: selectedAgent,
        timestamp: new Date(),
        status: content.toLowerCase().includes("draft") ? "draft" : "sent",
      };
      setMessages((prev) => [...prev, agentMessage]);
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
  }, [selectedAgent, messages, toast]);

  const handleAgentChange = (agent: AgentType) => {
    setSelectedAgent(agent);
    setMessages([]);
  };

  const showCommsList = activeTab !== "agents";

  return (
    <div className="flex flex-col h-full">
      {/* Header with Tabs */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          {/* Back button on mobile when viewing detail */}
          {selectedComm && showCommsList && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-1"
              onClick={() => setSelectedComm(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">Inbox</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Emails, calls, SMS & agent conversations</p>
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
      {showCommsList ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Communication List - full width on mobile, fixed on desktop */}
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

          {/* Communication Viewer - full width on mobile */}
          <div className={`${selectedComm ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
            <CommunicationViewer communication={selectedComm} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <AgentSelector selected={selectedAgent} onSelect={handleAgentChange} />
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
          />
        </div>
      )}
    </div>
  );
}
