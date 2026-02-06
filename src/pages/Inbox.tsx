import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSelector, AgentType } from "@/components/chat/AgentSelector";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { EmailList } from "@/components/email/EmailList";
import { EmailViewer } from "@/components/email/EmailViewer";
import { GmailMessage } from "@/lib/gmail";
import { MessageSquare, Mail } from "lucide-react";

// Demo responses for different agents
const agentResponses: Record<AgentType, string[]> = {
  sales: [
    "I found 3 open quotes that need follow-up. Want me to draft reminder emails?",
    "Looking at the margin on this quote — it's at 18%. Your guardrail is 22%. Should I adjust pricing?",
    "Draft quote ready for ABC Corp. Total: $12,450. Margin: 24%. Ready for your approval.",
  ],
  accounting: [
    "QuickBooks sync complete. 2 invoices pending, 1 payment received today.",
    "Customer XYZ has a balance of $3,200 — 45 days overdue. Want me to check their order history?",
    "I see a mismatch: QB shows $15,000 AR for this customer, but our records show $14,500. Investigating...",
  ],
  support: [
    "New support request from customer: 'Delivery was late.' Related order: #4521. Want me to pull the timeline?",
    "I've drafted a response acknowledging the delay and offering a credit. Needs your approval before sending.",
    "3 open tickets today. 1 urgent (delivery issue), 2 standard (product questions).",
  ],
  collections: [
    "AR aging report: $45K total. $12K is 60+ days. Want me to prioritize the list?",
    "Customer ABC hasn't responded to 2 emails. Last order was 90 days ago. Draft a final notice?",
    "Payment of $5,000 just posted from XYZ Corp. Their balance is now $0.",
  ],
  estimation: [
    "New estimation request: Custom cabinets, 12 units. Similar job last month was $8,200. Want me to start?",
    "Material costs updated. Plywood is up 8% from last quote. Should I recalculate open estimates?",
    "Estimate ready: Job #E-2024-15. Labor: $4,500, Materials: $3,200, Total: $7,700 at 26% margin.",
  ],
};

export default function Inbox() {
  const [activeTab, setActiveTab] = useState<"email" | "agents">("email");
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("sales");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<GmailMessage | null>(null);

  const handleSend = useCallback((content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      status: "sent",
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsTyping(true);
    setTimeout(() => {
      const responses = agentResponses[selectedAgent];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: randomResponse,
        agent: selectedAgent,
        timestamp: new Date(),
        status: content.toLowerCase().includes("draft") ? "draft" : "sent",
      };
      setMessages((prev) => [...prev, agentMessage]);
      setIsTyping(false);
    }, 800 + Math.random() * 800);
  }, [selectedAgent]);

  const handleAgentChange = (agent: AgentType) => {
    setSelectedAgent(agent);
    setMessages([]);
  };

  const handleRefreshEmails = () => {
    // EmailList handles its own refresh
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Tabs */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">Emails and agent conversations</p>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "email" | "agents")}>
          <TabsList>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Agents
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Content */}
      {activeTab === "email" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className="w-96 flex-shrink-0">
            <EmailList
              onSelectEmail={setSelectedEmail}
              selectedId={selectedEmail?.id}
            />
          </div>

          {/* Email Viewer */}
          <div className="flex-1">
            {selectedEmail ? (
              <EmailViewer email={selectedEmail} onRefresh={handleRefreshEmails} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select an email to read</p>
                </div>
              </div>
            )}
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
