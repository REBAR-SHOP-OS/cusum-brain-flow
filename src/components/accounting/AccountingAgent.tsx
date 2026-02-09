import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Send, Loader2, Minimize2, Maximize2, Shrink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendAgentMessage, ChatMessage } from "@/lib/agent";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import accountingHelper from "@/assets/helpers/accounting-helper.png";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
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
}

export function AccountingAgent({ onViewModeChange, viewMode: externalMode, qbSummary, autoGreet }: AccountingAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [internalMode, setInternalMode] = useState<ViewMode>("default");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

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

  // Auto-greet Vicky with daily briefing when panel opens
  const hasGreeted = useRef(false);
  useEffect(() => {
    if (!autoGreet || hasGreeted.current || messages.length > 0 || !qbSummary) return;
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

    const greetMsg = "Good morning! I just logged in. Give me my daily briefing — what's urgent, what's overdue, what needs my attention today? Be visual and use tables/badges.";
    
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: greetMsg,
      timestamp: new Date(),
    };
    setMessages([userMsg]);
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
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "agent",
          content: replyContent,
          timestamp: new Date(),
        }]);
      })
      .catch((err) => {
        console.error("Penny auto-greet error:", err);
      })
      .finally(() => setIsTyping(false));
  }, [autoGreet, qbSummary, messages.length]);

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
        timestamp: new Date(),
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

  const quickActions = [
    "What should I do today?",
    "Show overdue invoices",
    "Check my emails",
    "AR aging report",
  ];

  // Minimized view — just the header bar
  if (mode === "minimized") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-card">
        <img
          src={accountingHelper}
          alt="Penny"
          className="w-8 h-8 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">Penny</h3>
          <p className="text-xs text-muted-foreground truncate">
            {messages.length > 0 ? `${messages.length} messages` : "Ready to help"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMode("default")}
            title="Restore"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col border border-border rounded-xl bg-card overflow-hidden transition-all duration-300",
        mode === "fullscreen" ? "h-full" : "h-[420px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent shrink-0">
        <img
          src={accountingHelper}
          alt="Penny"
          className="w-10 h-10 rounded-xl object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm flex items-center gap-2">
            Penny
            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              50yr CPA
            </span>
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            Vicky's Accountability Partner • viky@ & accounting@ inbox
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMode("minimized")}
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMode(mode === "fullscreen" ? "default" : "fullscreen")}
            title={mode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}
          >
            {mode === "fullscreen" ? (
              <Shrink className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden">
              <img
                src={accountingHelper}
                alt="Penny"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Morning, Vicky.
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                I've checked your emails and QuickBooks. Ask me what needs attention today.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    setInputValue(action);
                    setTimeout(() => {
                      setInputValue(action);
                      handleSendDirect(action);
                    }, 0);
                  }}
                  className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "agent" && (
                  <img
                    src={accountingHelper}
                    alt="Penny"
                    className="w-7 h-7 rounded-lg object-cover shrink-0 mt-1"
                  />
                )}
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm overflow-x-auto",
                    msg.role === "user"
                      ? "max-w-[85%] bg-primary text-primary-foreground"
                      : mode === "fullscreen" ? "max-w-[90%] bg-muted" : "max-w-[85%] bg-muted"
                  )}
                >
                  {msg.role === "agent" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-border [&_tr:nth-child(even)]:bg-muted/30">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center gap-2">
                <img
                  src={accountingHelper}
                  alt="Penny"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Penny is reviewing...
                  </span>
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
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Direct send for quick actions
  function handleSendDirect(text: string) {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages([userMsg]);
    setIsTyping(true);
    setInputValue("");

    sendAgentMessage("accounting", text, [])
      .then((response) => {
        const agentMsg: Message = {
          id: crypto.randomUUID(),
          role: "agent",
          content: response.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      })
      .catch((error) => {
        console.error("Penny error:", error);
        toast({
          title: "Penny unavailable",
          description:
            error instanceof Error ? error.message : "Failed to get response",
          variant: "destructive",
        });
      })
      .finally(() => setIsTyping(false));
  }
}
