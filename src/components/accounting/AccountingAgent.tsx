import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Send, Loader2, Minimize2, Maximize2, Shrink, Mail, DollarSign, ListChecks, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendAgentMessage, ChatMessage } from "@/lib/agent";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import accountingHelper from "@/assets/helpers/accounting-helper.png";
import { PennyCallCard, parsePennyCalls, type PennyCallData } from "./PennyCallCard";
import type { WebPhoneState, WebPhoneActions } from "@/hooks/useWebPhone";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  calls?: PennyCallData[];
}

type ViewMode = "default" | "minimized" | "fullscreen";

interface QBSummary {
  totalReceivable: number;
  totalPayable: number;
  overdueInvoices: { Id: string; DocNumber: string; CustomerRef: { name: string }; Balance: number; DueDate: string }[];
  overdueBills: { Id: string; DocNumber: string; VendorRef: { name: string }; Balance: number; DueDate: string }[];
  invoices: { Balance: number; DueDate: string }[];
  bills: { Balance: number; DueDate: string }[];
  accounts: { Name: string; CurrentBalance: number; AccountType: string }[];
  payments: { TotalAmt: number; TxnDate: string }[];
}

interface AccountingAgentProps {
  onViewModeChange?: (mode: ViewMode) => void;
  viewMode?: ViewMode;
  qbSummary?: QBSummary;
  autoGreet?: boolean;
  webPhoneState?: WebPhoneState;
  webPhoneActions?: WebPhoneActions;
}

const checkingPhases = [
  { label: "Scanning your inbox...", Icon: Mail },
  { label: "Reviewing financials...", Icon: DollarSign },
  { label: "Prioritizing your tasks...", Icon: ListChecks },
];

export function AccountingAgent({ onViewModeChange, viewMode: externalMode, qbSummary, autoGreet, webPhoneState, webPhoneActions }: AccountingAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [internalMode, setInternalMode] = useState<ViewMode>("default");
  const [checkingPhase, setCheckingPhase] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const userName = useMemo(() => {
    const full = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    return full.split(" ")[0];
  }, [user]);

  const mode = externalMode ?? internalMode;

  const setMode = useCallback((newMode: ViewMode) => {
    setInternalMode(newMode);
    onViewModeChange?.(newMode);
  }, [onViewModeChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [inputValue]);

  // Checking-phase animation: cycle through phases while auto-greet is loading
  useEffect(() => {
    if (!isTyping || messages.length > 0) return;
    setCheckingPhase(0);
    const interval = setInterval(() => {
      setCheckingPhase((prev) => (prev + 1) % checkingPhases.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isTyping, messages.length]);

  // Auto-greet with enhanced priority-list prompt
  const hasGreeted = useRef(false);
  useEffect(() => {
    if (!autoGreet || hasGreeted.current || messages.length > 0) return;
    if (!qbSummary || qbSummary.invoices.length === 0 && qbSummary.bills.length === 0 && qbSummary.accounts.length === 0) return;
    hasGreeted.current = true;

    const context: Record<string, unknown> = {
      totalReceivable: qbSummary.totalReceivable,
      totalPayable: qbSummary.totalPayable,
      overdueInvoiceCount: qbSummary.overdueInvoices.length,
      overdueInvoiceTotal: qbSummary.overdueInvoices.reduce((s, i) => s + i.Balance, 0),
      overdueInvoicesList: qbSummary.overdueInvoices.slice(0, 10).map(i => ({
        doc: i.DocNumber, customer: i.CustomerRef.name, balance: i.Balance, due: i.DueDate,
      })),
      overdueBillCount: qbSummary.overdueBills.length,
      overdueBillTotal: qbSummary.overdueBills.reduce((s, b) => s + b.Balance, 0),
      overdueBillsList: qbSummary.overdueBills.slice(0, 10).map(b => ({
        doc: b.DocNumber, vendor: b.VendorRef.name, balance: b.Balance, due: b.DueDate,
      })),
      bankAccounts: qbSummary.accounts
        .filter(a => a.AccountType === "Bank")
        .map(a => ({ name: a.Name, balance: a.CurrentBalance })),
      recentPayments: qbSummary.payments.slice(0, 5).map(p => ({
        amount: p.TotalAmt, date: p.TxnDate,
      })),
      unpaidInvoiceCount: qbSummary.invoices.filter(i => i.Balance > 0).length,
      unpaidBillCount: qbSummary.bills.filter(b => b.Balance > 0).length,
    };

    const greetMsg = `Daily briefing request. Today is ${new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}. Use the context data I'm providing to create a prioritized daily action list for ${userName}. 

FORMAT REQUIREMENTS — follow exactly:
1. Start with a one-line summary: "🔥 X items need your attention today" (count the real action items)
2. Then a warm one-liner greeting for ${userName}

3. **🚨 URGENT — Act Now** section: Overdue invoices, overdue bills, anything past-due. Use a markdown table: | # | Action | Source | Amount | Days Overdue |
4. **📅 TODAY — Due Today** section: Items due today or needing same-day action. Numbered list with source tags [QuickBooks] [Email] [Task]
5. **📋 THIS WEEK — Upcoming** section: Items due this week. Numbered list with source tags
6. **🏦 Cash Position**: One-line bank balance summary
7. **✅ Bottom Line**: "You're on track" OR "X items need immediate action — start with #1 above"

RULES:
- Tag every item with its source: [QuickBooks], [Email], or [Task]
- Bold all dollar amounts
- Keep sentences SHORT — max 15 words each
- Use emoji bullets, not plain dashes
- If there are 0 urgent items, say "✅ Nothing urgent — nice!" and skip that section`;
    
    setIsTyping(true);

    sendAgentMessage("accounting", greetMsg, [], context)
      .then((response) => {
        let replyContent = response.reply;
        if (response.createdNotifications?.length) {
          const notifSummary = response.createdNotifications
            .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
            .join("\n");
          replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
        }
        const { cleanText, calls } = parsePennyCalls(replyContent);
        setMessages([{
          id: crypto.randomUUID(),
          role: "agent",
          content: cleanText,
          timestamp: new Date(),
          calls: calls.length > 0 ? calls : undefined,
        }]);
      })
      .catch((err) => {
        console.error("Penny auto-greet error:", err);
      })
      .finally(() => setIsTyping(false));
  }, [autoGreet, qbSummary]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const qbContext: Record<string, unknown> = qbSummary ? {
        totalReceivable: qbSummary.totalReceivable,
        totalPayable: qbSummary.totalPayable,
        overdueInvoiceCount: qbSummary.overdueInvoices.length,
        overdueBillCount: qbSummary.overdueBills.length,
        unpaidInvoiceCount: qbSummary.invoices.filter(i => i.Balance > 0).length,
      } : {};

      const response = await sendAgentMessage(
        "accounting",
        userMsg.content,
        history,
        qbContext
      );

      let replyContent = response.reply;
      if (response.createdNotifications && response.createdNotifications.length > 0) {
        const notifSummary = response.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }

      const { cleanText, calls } = parsePennyCalls(replyContent);
      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: cleanText,
        timestamp: new Date(),
        calls: calls.length > 0 ? calls : undefined,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (error) {
      console.error("Penny error:", error);
      toast({
        title: "Penny unavailable",
        description:
          error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, isTyping, messages, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const postBriefingActions = [
    "Drill into overdue AR",
    "Show email details",
    "Cash flow forecast",
    "Create follow-up tasks",
  ];

  // Has the first briefing message loaded?
  const briefingLoaded = messages.length > 0 && messages[0]?.role === "agent";

  // Minimized view
  if (mode === "minimized") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-card">
        <img src={accountingHelper} alt="Penny" className="w-8 h-8 rounded-lg object-cover" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">Penny</h3>
          <p className="text-xs text-muted-foreground truncate">
            {messages.length > 0 ? `${messages.length} messages` : "Ready to help"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMode("default")} title="Restore">
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col border border-border rounded-xl bg-card overflow-hidden transition-all duration-300 h-full min-h-0")}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent shrink-0">
        <img src={accountingHelper} alt="Penny" className="w-10 h-10 rounded-xl object-cover" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm flex items-center gap-2">
            Penny
            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">50yr CPA</span>
          </h3>
        </div>
        <div className="flex items-center gap-0.5">
          {webPhoneState && (webPhoneState.status === "calling" || webPhoneState.status === "in_call") && (
            <Button variant="destructive" size="sm" className="h-7 gap-1 mr-1 text-xs" onClick={() => webPhoneActions?.hangup()}>
              <PhoneOff className="w-3 h-3" />
              {webPhoneState.status === "calling" ? "Dialing..." : "On Call"}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMode("minimized")} title="Minimize">
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMode(mode === "fullscreen" ? "default" : "fullscreen")} title={mode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}>
            {mode === "fullscreen" ? <Shrink className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {/* Checking animation when auto-greeting is loading (no messages yet) */}
        {messages.length === 0 && isTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-5">
            <img src={accountingHelper} alt="Penny" className="w-14 h-14 rounded-2xl object-cover" />
            <div className="space-y-4 w-full max-w-xs">
              {checkingPhases.map((phase, idx) => {
                const isActive = idx === checkingPhase;
                const isDone = idx < checkingPhase;
                return (
                  <div
                    key={phase.label}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500",
                      isActive ? "bg-primary/10 scale-[1.02]" : isDone ? "bg-muted/60 opacity-60" : "opacity-30"
                    )}
                  >
                    <phase.Icon className={cn(
                      "w-4.5 h-4.5 shrink-0 transition-all duration-300",
                      isActive ? "text-primary animate-pulse" : isDone ? "text-muted-foreground" : "text-muted-foreground/40"
                    )} />
                    <span className={cn(
                      "text-sm transition-all duration-300",
                      isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}>
                      {phase.label}
                    </span>
                    {isDone && <span className="ml-auto text-xs text-primary">✓</span>}
                    {isActive && <Loader2 className="ml-auto w-3.5 h-3.5 animate-spin text-primary" />}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground animate-pulse mt-2">Building your priority list...</p>
          </div>
        )}

        {/* Empty state — only if not auto-greeting */}
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden">
              <img src={accountingHelper} alt="Penny" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-sm">Morning, {userName}.</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                I've checked your emails and QuickBooks. Ask me what needs attention today.
              </p>
            </div>
          </div>
        )}

        {/* Rendered messages */}
        {messages.length > 0 && (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "agent" && (
                    <img src={accountingHelper} alt="Penny" className="w-7 h-7 rounded-lg object-cover shrink-0 mt-1" />
                  )}
                  <div className={cn(
                    "rounded-xl px-3 py-2 text-sm overflow-x-auto",
                    msg.role === "user"
                      ? "max-w-[85%] bg-primary text-primary-foreground"
                      : mode === "fullscreen" ? "max-w-[90%] bg-muted" : "max-w-[85%] bg-muted"
                  )}>
                    {msg.role === "agent" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-border [&_tr:nth-child(even)]:bg-muted/30">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
                {/* Render call cards for this message */}
                {msg.calls && msg.calls.length > 0 && webPhoneState && webPhoneActions && (
                  <div className="ml-9 space-y-2">
                    {msg.calls.map((call, idx) => (
                      <PennyCallCard
                        key={`${msg.id}-call-${idx}`}
                        data={call}
                        callStatus={webPhoneState.status}
                        onCall={(phone, name) => webPhoneActions.call(phone, name)}
                        onHangup={() => webPhoneActions.hangup()}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Post-briefing quick actions — shown after first AI response */}
            {briefingLoaded && !isTyping && messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {postBriefingActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleSendDirect(action)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}

            {isTyping && (
              <div className="flex items-center gap-2">
                <img src={accountingHelper} alt="Penny" className="w-7 h-7 rounded-lg object-cover" />
                <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Penny is reviewing...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Penny about invoices, emails, tasks..."
            className="flex-1 resize-none bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[120px]"
            rows={1}
            disabled={isTyping}
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={!inputValue.trim() || isTyping}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  function handleSendDirect(text: string) {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setInputValue("");

    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    const qbContext: Record<string, unknown> = qbSummary ? {
      totalReceivable: qbSummary.totalReceivable,
      totalPayable: qbSummary.totalPayable,
      overdueInvoiceCount: qbSummary.overdueInvoices.length,
      overdueBillCount: qbSummary.overdueBills.length,
    } : {};

    sendAgentMessage("accounting", text, history, qbContext)
      .then((response) => {
        const { cleanText, calls } = parsePennyCalls(response.reply);
        const agentMsg: Message = {
          id: crypto.randomUUID(),
          role: "agent",
          content: cleanText,
          timestamp: new Date(),
          calls: calls.length > 0 ? calls : undefined,
        };
        setMessages((prev) => [...prev, agentMsg]);
      })
      .catch((error) => {
        console.error("Penny error:", error);
        toast({
          title: "Penny unavailable",
          description: error instanceof Error ? error.message : "Failed to get response",
          variant: "destructive",
        });
      })
      .finally(() => setIsTyping(false));
  }
}
