import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, ArrowUp } from "lucide-react";
import { Message } from "@/components/chat/ChatMessage";
import { sendAgentMessage, ChatMessage as AgentChatMessage } from "@/lib/agent";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useAuth } from "@/lib/auth";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { cn } from "@/lib/utils";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { MessageActions } from "@/components/chat/MessageActions";

const config = agentConfigs.empire;

const SUGGESTIONS = [
  "Run a full health check on all my apps",
  "Diagnose and fix any WordPress issues on rebar.shop",
  "Check Odoo CRM sync status",
  "I have a SaaS idea for contractor scheduling",
  "Stress test my latest venture",
  "What problems need my attention right now?",
];

export default function EmpireBuilder() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [value, setValue] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomInputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { createSession, addMessage } = useChatSessions();
  const hasConversation = messages.length > 0;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  }, [value]);

  useEffect(() => {
    const ta = bottomInputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  }, [value, hasConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setValue("");

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession(content, config.name);
      setActiveSessionId(sessionId);
    }
    if (sessionId) addMessage(sessionId, "user", content);

    try {
      const history: AgentChatMessage[] = messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
      const response = await sendAgentMessage(config.agentType, content, history);
      let replyContent = response.reply;
      if (response.createdNotifications?.length) {
        const notifSummary = response.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", content: replyContent, agent: config.agentType as any, timestamp: new Date() }]);
      if (sessionId) addMessage(sessionId, "agent", response.reply, config.agentType);
    } catch (error) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", content: `Sorry, I encountered an error. ${error instanceof Error ? error.message : ""}`, agent: config.agentType as any, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, activeSessionId, createSession, addMessage]);

  const handleSubmit = () => { if (value.trim()) handleSend(value.trim()); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  // Shared input component
  const InputBox = ({ large = false }: { large?: boolean }) => (
    <div className={cn(
      "backdrop-blur-sm rounded-2xl border shadow-sm transition-all",
      "bg-amber-50/80 dark:bg-card/80 border-amber-200/50 dark:border-border/50",
      "focus-within:shadow-lg focus-within:border-amber-300/60 dark:focus-within:border-primary/30",
      large && "shadow-lg shadow-amber-100/20 dark:shadow-none"
    )}>
      <div className={cn("px-5 pb-1", large ? "pt-4" : "pt-3")}>
        <textarea
          ref={large ? textareaRef : bottomInputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={large ? "Ask Architect to build a venture about..." : "Message Architect..."}
          rows={large ? 2 : 1}
          disabled={isLoading}
          className="w-full bg-transparent resize-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
        />
      </div>
      <div className="flex items-center px-4 pb-3">
        <button type="button" className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <Plus className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          className={cn(
            "rounded-full flex items-center justify-center transition-all",
            large ? "w-9 h-9" : "w-8 h-8",
            value.trim() && !isLoading
              ? "bg-foreground text-background hover:opacity-80 shadow-sm"
              : "bg-muted/60 text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          <ArrowUp className={large ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/60 via-purple-50/30 to-pink-200/50 dark:from-blue-950/30 dark:via-purple-950/15 dark:to-pink-950/25" />
        <div className="absolute top-[-10%] left-[10%] w-[700px] h-[700px] rounded-full bg-blue-200/30 dark:bg-blue-900/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-pink-200/40 dark:bg-pink-900/10 blur-[130px]" />
        <div className="absolute top-[30%] right-[25%] w-[400px] h-[400px] rounded-full bg-violet-200/20 dark:bg-violet-900/8 blur-[110px]" />
      </div>

      {!hasConversation ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
          <div className="text-center mb-10 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Build something{" "}
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                great
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-md mx-auto">
              Describe your venture idea and let AI structure, validate, and execute the plan.
            </p>
          </div>

          <div className="w-full max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <InputBox large />
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl animate-fade-in" style={{ animationDelay: "200ms" }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="px-4 py-2.5 text-sm rounded-full border border-border/50 bg-background/50 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background/80 hover:border-border hover:shadow-sm transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative z-10 min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={cn("flex gap-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                        <span className="text-white text-xs font-bold">A</span>
                      </div>
                    )}
                    <div className={cn("max-w-[80%] min-w-0")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed min-w-0 [overflow-wrap:anywhere]",
                          isUser
                            ? "bg-foreground text-background rounded-br-md"
                            : "bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm rounded-bl-md"
                        )}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <RichMarkdown content={message.content || ""} />
                        )}
                      </div>
                      {!isUser && message.content && (
                        <MessageActions content={message.content} messageId={message.id} />
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-border/20 bg-background/40 backdrop-blur-md px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <InputBox />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
