import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { sendAgentMessage, AgentType, ChatMessage as AgentChatMessage } from "@/lib/agent";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { AgentSuggestions } from "@/components/agent/AgentSuggestions";
import { agentSuggestions } from "@/components/agent/agentSuggestionsData";
import { cn } from "@/lib/utils";

// Agent helper images
import salesHelper from "@/assets/helpers/sales-helper.png";
import supportHelper from "@/assets/helpers/support-helper.png";
import accountingHelper from "@/assets/helpers/accounting-helper.png";
import estimatingHelper from "@/assets/helpers/estimating-helper.png";
import shopfloorHelper from "@/assets/helpers/shopfloor-helper.png";
import deliveryHelper from "@/assets/helpers/delivery-helper.png";
import emailHelper from "@/assets/helpers/email-helper.png";
import dataHelper from "@/assets/helpers/data-helper.png";
import socialHelper from "@/assets/helpers/social-helper.png";

interface AgentConfig {
  name: string;
  role: string;
  image: string;
  agentType: AgentType;
  greeting: string;
  placeholder: string;
  capabilities: string[];
}

const agentConfigs: Record<string, AgentConfig> = {
  sales: {
    name: "Salesy",
    role: "Sales & Pipeline",
    image: salesHelper,
    agentType: "sales",
    greeting: "Hey! I'm Salesy, your Sales & Pipeline agent. I can check your pipeline, create leads, move deals, and draft follow-up messages. What do you need?",
    placeholder: "Ask about pipeline, leads, deals...",
    capabilities: ["Check pipeline status", "Create new leads", "Move deals between stages", "Draft follow-ups"],
  },
  support: {
    name: "Sasha",
    role: "Customer Support",
    image: supportHelper,
    agentType: "support",
    greeting: "Hi! I'm Sasha, your Customer Support agent. I can look up customers, check their history, and help draft responses. How can I help?",
    placeholder: "Ask about customers, tickets, support...",
    capabilities: ["Look up customers", "View customer history", "Draft support responses", "Create tasks"],
  },
  accounting: {
    name: "Archie",
    role: "Accounting",
    image: accountingHelper,
    agentType: "accounting",
    greeting: "Hello! I'm Archie, your Accounting agent. I connect to QuickBooks to check invoices, create estimates, and track financials. What do you need?",
    placeholder: "Ask about invoices, estimates, financials...",
    capabilities: ["Check invoices", "Create estimates", "QuickBooks sync", "Financial summaries"],
  },
  estimating: {
    name: "Eddie",
    role: "Estimating",
    image: estimatingHelper,
    agentType: "estimation",
    greeting: "Hey! I'm Eddie, your Rebar Estimating agent. Upload drawings and I'll extract quantities, calculate weights, and produce takeoff reports. Ready when you are!",
    placeholder: "Upload drawings or ask about estimates...",
    capabilities: ["Analyze drawings (PDF/DWG)", "Extract rebar quantities", "Calculate weights", "Produce takeoff reports"],
  },
  shopfloor: {
    name: "Steely",
    role: "Shop Floor",
    image: shopfloorHelper,
    agentType: "support",
    greeting: "I'm Steely, your Shop Floor agent. I track work orders, machine status, and production schedules. What needs attention?",
    placeholder: "Ask about work orders, production...",
    capabilities: ["Track work orders", "Check machine status", "View production schedule", "Report issues"],
  },
  delivery: {
    name: "Danny",
    role: "Deliveries",
    image: deliveryHelper,
    agentType: "support",
    greeting: "Hi! I'm Danny, your Delivery agent. I can check routes, track deliveries, and help coordinate stops. Where are we heading?",
    placeholder: "Ask about deliveries, routes, stops...",
    capabilities: ["Track deliveries", "Check routes", "Update stop status", "Coordinate drivers"],
  },
  email: {
    name: "Emmy",
    role: "Email & Inbox",
    image: emailHelper,
    agentType: "support",
    greeting: "Hey! I'm Emmy, your Email & Inbox agent. I can summarize emails, draft replies, and create tasks from messages. What's in your inbox?",
    placeholder: "Ask about emails, drafts, inbox...",
    capabilities: ["Summarize inbox", "Draft email replies", "Create tasks from emails", "Find important messages"],
  },
  social: {
    name: "Sushie",
    role: "Social Media",
    image: socialHelper,
    agentType: "social",
    greeting: "Hi! I'm Sushie, your Social Media agent. I'll help create posts, plan content, and manage your social presence. What should we post?",
    placeholder: "Ask about social posts, content ideas...",
    capabilities: ["Draft social posts", "Content calendar", "Hashtag suggestions", "Platform-specific content"],
  },
  data: {
    name: "Dexter",
    role: "Data & Insights",
    image: dataHelper,
    agentType: "support",
    greeting: "Hello! I'm Dexter, your Data & Insights agent. I analyze trends, generate reports, and help you understand your business metrics. What do you want to know?",
    placeholder: "Ask about reports, trends, analytics...",
    capabilities: ["Business analytics", "Generate reports", "Trend analysis", "KPI tracking"],
  },
};

export default function AgentWorkspace() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const config = agentConfigs[agentId || ""] || agentConfigs.sales;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataPanelExpanded, setDataPanelExpanded] = useState(true);

  const hasConversation = messages.length > 0;
  const suggestions = agentSuggestions[agentId || "sales"] || agentSuggestions.sales;

  const handleSend = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history: AgentChatMessage[] = messages
        .map((m) => ({
          role: m.role === "user" ? "user" as const : "assistant" as const,
          content: m.content,
        }));

      const response = await sendAgentMessage(config.agentType, content, history);
      
      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: response.reply,
        agent: config.agentType as any,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: `Sorry, I encountered an error. Please try again. ${error instanceof Error ? error.message : ""}`,
        agent: config.agentType as any,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, config.agentType]);

  return (
    <div className="flex h-full">
      {/* Data Panel - Left side */}
      {dataPanelExpanded && (
        <div className="w-[45%] border-r border-border flex flex-col animate-fade-in">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <img src={config.image} alt={config.name} className="w-8 h-8 rounded-lg object-cover" />
              <div>
                <h2 className="text-sm font-semibold">{config.name}</h2>
                <p className="text-xs text-muted-foreground">{config.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDataPanelExpanded(false)}
              title="Collapse panel"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
          <AgentDataPanel agentId={agentId || "sales"} />
        </div>
      )}

      {/* Chat Panel - Right side */}
      <div className={cn("flex flex-col", dataPanelExpanded ? "flex-1" : "flex-1")}>
        <div className="flex items-center gap-3 p-3 border-b border-border">
          {!dataPanelExpanded && (
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <img src={config.image} alt={config.name} className="w-8 h-8 rounded-lg object-cover" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold">{config.name}</h2>
                <p className="text-xs text-muted-foreground">{config.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDataPanelExpanded(true)}
                title="Show data panel"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {dataPanelExpanded && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-sm font-medium">Chat with {config.name}</span>
              {isLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">thinking...</span>
              )}
            </div>
          )}
        </div>

        {/* Chat area: hero greeting or conversation */}
        {!hasConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
            {/* Hero greeting */}
            <div className="text-center mb-8 px-4">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Hey, it's <span className="text-primary">{config.name}</span>.
              </h1>
              <p className="text-xl sm:text-2xl font-semibold text-foreground mt-1">
                What can I help you with?
              </p>
            </div>

            {/* Chat input in center */}
            <div className="w-full max-w-xl px-4 mb-6">
              <ChatInput
                onSend={handleSend}
                placeholder={config.placeholder}
                disabled={isLoading}
                showFileUpload={agentId === "estimating"}
              />
            </div>

            {/* Scroll-down divider */}
            <div className="flex justify-center mb-4">
              <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
            </div>

            {/* Suggestion cards */}
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
            />
          </>
        )}
      </div>
    </div>
  );
}
