import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAgentSuggestions } from "@/hooks/useAgentSuggestions";
import { Send, Loader2, Minimize2, Maximize2, Shrink, Mail, DollarSign, ListChecks, PhoneOff, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendAgentMessage, ChatMessage, AttachedFile } from "@/lib/agent";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { RichMarkdown, type ActionItemCallbacks } from "@/components/chat/RichMarkdown";
import type { TableRowActionCallbacks } from "@/components/accounting/TableRowActions";
import accountingHelper from "@/assets/helpers/accounting-helper.png";
import { PennyCallCard, parsePennyCalls, type PennyCallData } from "./PennyCallCard";
import type { WebPhoneState, WebPhoneActions } from "@/hooks/useWebPhone";
import { useCallTask, type CallTaskOutcome } from "@/hooks/useCallTask";

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

export const AccountingAgent = React.forwardRef<HTMLDivElement, AccountingAgentProps>(function AccountingAgent({ onViewModeChange, viewMode: externalMode, qbSummary, autoGreet, webPhoneState, webPhoneActions }, ref) {
  const { suggestions: pennySuggestions } = useAgentSuggestions("penny");
  const { activeTask, createCallTask, startCall, onCallConnected, completeCall, failCall, cancelCall, clearTask } = useCallTask();
  const [showOutcome, setShowOutcome] = useState(false);
  const [dismissedItems] = useState(() => new Set<string>());
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [rescheduledItems] = useState(() => new Map<string, Date>());
  const [rescheduledVersion, setRescheduledVersion] = useState(0);
  const prevCallStatusRef = useRef<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [internalMode, setInternalMode] = useState<ViewMode>("default");
  const [checkingPhase, setCheckingPhase] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<{ file: File; previewUrl: string; uploading: boolean }[]>([]);
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
    if (!qbSummary || (qbSummary.invoices.length === 0 && qbSummary.bills.length === 0 && qbSummary.accounts.length === 0)) return;
    hasGreeted.current = true;

    const context: Record<string, unknown> = {
      totalReceivable: qbSummary.totalReceivable,
      totalPayable: qbSummary.totalPayable,
      overdueInvoiceCount: qbSummary.overdueInvoices.length,
      overdueInvoiceTotal: qbSummary.overdueInvoices.reduce((s, i) => s + i.Balance, 0),
      overdueInvoicesList: qbSummary.overdueInvoices.slice(0, 10).map(i => ({
        doc: i.DocNumber, customer: i.CustomerRef?.name ?? "Unknown", balance: i.Balance, due: i.DueDate,
      })),
      overdueBillCount: qbSummary.overdueBills.length,
      overdueBillTotal: qbSummary.overdueBills.reduce((s, b) => s + b.Balance, 0),
      overdueBillsList: qbSummary.overdueBills.slice(0, 10).map(b => ({
        doc: b.DocNumber, vendor: b.VendorRef?.name ?? "Unknown", balance: b.Balance, due: b.DueDate,
      })),
      bankAccounts: qbSummary.accounts
        .filter(a => a.AccountType === "Bank")
        .map(a => ({ name: a.Name, balance: a.CurrentBalance })),
      recentPayments: qbSummary.payments.slice(0, 5).map(p => ({
        amount: p.TotalAmt, date: p.TxnDate,
      })),
      unpaidInvoiceCount: qbSummary.invoices.filter(i => i.Balance > 0).length,
      unpaidBillCount: qbSummary.bills.filter(b => b.Balance > 0).length,
      pennySuggestions: pennySuggestions.slice(0, 10).map(s => ({
        title: s.title,
        description: s.description,
        impact: s.impact,
        severity: s.severity,
        category: s.category,
      })),
    };

    const greetMsg = `Daily briefing request. Today is ${new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}. Use the context data I'm providing to create a prioritized daily action list for ${userName}. 

FORMAT REQUIREMENTS — follow exactly:
1. Start with a one-line summary: "🔥 X items need your attention today" (count the real action items)
2. Then a warm one-liner greeting for ${userName}

3. **🚨 URGENT — Act Now** section: Overdue invoices, overdue bills, anything past-due. Use a markdown table: | # | Action | Source | Amount | Days Overdue |
4. **📅 TODAY — Due Today** section: Items due today or needing same-day action. Numbered list with source tags [QuickBooks] [Email] [Task]
5. **📋 THIS WEEK — Upcoming** section: Items due this week. Numbered list with source tags
6. **💡 PENNY SUGGESTIONS** section: Include ALL items from pennySuggestions in the context — these are AI-generated action items I've identified. Show each with its severity, impact, and recommended action.
7. **🏦 Cash Position**: One-line bank balance summary
8. **✅ Bottom Line**: "You're on track" OR "X items need immediate action — start with #1 above"

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

  const uploadFile = async (file: File): Promise<{ name: string; url: string } | null> => {
    const path = `chat-uploads/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("clearance-photos").upload(path, file);
    if (error) { console.error("Upload failed:", error); return null; }
    const { data: urlData } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 3600);
    return urlData?.signedUrl ? { name: file.name, url: urlData.signedUrl } : null;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const newAttachments = Array.from(files)
      .filter(f => f.type.startsWith("image/") || f.type === "application/pdf" || f.type === "application/zip" || f.name.endsWith(".zip"))
      .slice(0, 5)
      .map(file => ({ file, previewUrl: URL.createObjectURL(file), uploading: false }));
    if (newAttachments.length === 0) { toast({ title: "Unsupported file", description: "Only images, PDFs, and ZIP files are supported", variant: "destructive" }); return; }
    setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
  }, [toast]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => { const r = prev[index]; if (r) URL.revokeObjectURL(r.previewUrl); return prev.filter((_, i) => i !== index); });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) { if (items[i].type.startsWith("image/")) { const f = items[i].getAsFile(); if (f) imageFiles.push(f); } }
    if (imageFiles.length > 0) { e.preventDefault(); addFiles(imageFiles); }
  }, [addFiles]);

  const handleSend = useCallback(async () => {
    if ((!inputValue.trim() && attachments.length === 0) || isTyping) return;

    // Upload attachments
    let attachedFiles: AttachedFile[] | undefined;
    if (attachments.length > 0) {
      setAttachments(prev => prev.map(a => ({ ...a, uploading: true })));
      const uploaded: AttachedFile[] = [];
      for (const att of attachments) {
        const result = await uploadFile(att.file);
        if (result) uploaded.push(result);
      }
      attachments.forEach(a => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);
      if (uploaded.length > 0) attachedFiles = uploaded;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim() || (attachedFiles ? `Analyze ${attachedFiles.length} attached file(s)` : ""),
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
        overdueInvoices: qbSummary.overdueInvoices.slice(0, 20).map(i => ({
          doc: i.DocNumber, customer: i.CustomerRef?.name, balance: i.Balance, due: i.DueDate,
        })),
        overdueBills: qbSummary.overdueBills.slice(0, 20).map(b => ({
          doc: b.DocNumber, vendor: b.VendorRef?.name, balance: b.Balance, due: b.DueDate,
        })),
        bankAccounts: qbSummary.accounts
          .filter(a => a.AccountType === "Bank")
          .map(a => ({ name: a.Name, balance: a.CurrentBalance })),
        recentPayments: qbSummary.payments.slice(0, 10).map(p => ({
          amount: p.TotalAmt, date: p.TxnDate,
        })),
        unpaidInvoiceCount: qbSummary.invoices.filter(i => i.Balance > 0).length,
        unpaidBillCount: qbSummary.bills.filter(b => b.Balance > 0).length,
        pennySuggestions: pennySuggestions.slice(0, 10).map(s => ({
          title: s.title, description: s.description, impact: s.impact, severity: s.severity, category: s.category,
        })),
      } : {};

      const response = await sendAgentMessage(
        "accounting",
        userMsg.content,
        history,
        qbContext,
        attachedFiles
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
  }, [inputValue, isTyping, messages, toast, attachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const actionItemCallbacks: ActionItemCallbacks = {
    onIgnore: (text: string, reason: string) => {
      dismissedItems.add(text);
      setDismissedVersion(v => v + 1);
      toast({ title: "Item dismissed", description: reason });
    },
    onReschedule: (text: string, date: Date) => {
      rescheduledItems.set(text, date);
      setRescheduledVersion(v => v + 1);
      toast({ title: "Rescheduled", description: `Moved to ${date.toLocaleDateString()}` });
    },
    onSummarize: (text: string) => {
      handleSendDirect(`Summarize this item in detail: ${text}`);
    },
  };

  const tableRowCallbacks: TableRowActionCallbacks = {
    onCall: (rowText: string) => {
      handleSendDirect(`Call the customer about: ${rowText}`);
    },
    onText: (rowText: string) => {
      handleSendDirect(`Send a text message to the customer about: ${rowText}`);
    },
    onEmail: (rowText: string, subject: string, body: string) => {
      handleSendDirect(`Draft and send an email about: ${rowText}\nSubject: ${subject}\nBody: ${body}`);
      toast({ title: "Email queued", description: `Subject: ${subject}` });
    },
    onReschedule: (rowText: string, date: Date, reason: string) => {
      rescheduledItems.set(rowText, date);
      setRescheduledVersion(v => v + 1);
      toast({ title: "Activity rescheduled", description: `${reason} → ${date.toLocaleDateString()}` });
    },
  };

  const postBriefingActions = [
    "Drill into overdue AR",
    "Show my queue",
    "Approve all low-risk",
    "Cash flow forecast",
    "Create follow-up tasks",
  ];

  // Has the first briefing message loaded?
  const briefingLoaded = messages.length > 0 && messages[0]?.role === "agent";

  // Minimized view
  if (mode === "minimized") {
    return (
      <div ref={ref} className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-card">
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
    <div ref={ref} className={cn("flex flex-col border border-border rounded-xl bg-card overflow-hidden transition-all duration-300 h-full min-h-0")}>
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
                      <RichMarkdown
                        content={msg.content}
                        onActionItem={actionItemCallbacks}
                        onTableRowAction={tableRowCallbacks}
                        dismissedItems={dismissedItems}
                        rescheduledItems={rescheduledItems}
                      />
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
                        onCall={async (phone, name) => {
                          // Create call task first, then dial
                          const taskId = await createCallTask({
                            phone,
                            contact_name: name,
                            reason: call.reason,
                            lead_id: call.lead_id,
                            contact_id: call.contact_id,
                          });
                          if (taskId) {
                            await startCall(taskId);
                            webPhoneActions.call(phone, name);
                          }
                        }}
                        onHangup={() => {
                          webPhoneActions.hangup();
                          // Show outcome buttons after hangup
                          if (activeTask) {
                            setShowOutcome(true);
                          }
                        }}
                        taskStatus={activeTask?.status}
                        attemptCount={activeTask?.attempt_count}
                        showOutcome={showOutcome && activeTask?.status !== "done"}
                        onOutcome={async (outcome: CallTaskOutcome) => {
                          if (activeTask) {
                            await completeCall(activeTask.id, outcome, []);
                            setShowOutcome(false);
                          }
                        }}
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

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="px-3 pb-1 shrink-0 flex gap-2 flex-wrap border-t border-border pt-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted">
              {att.file.type.startsWith("image/") ? (
                <img src={att.previewUrl} alt="attachment" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              {att.uploading && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
              )}
              {!att.uploading && (
                <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.zip,application/zip" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />
        <div className="flex items-end gap-2">
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} disabled={isTyping} title="Attach file">
            <Paperclip className="w-4 h-4" />
          </Button>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask Penny about invoices, emails, tasks..."
            className="flex-1 resize-none bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[120px]"
            rows={1}
            disabled={isTyping}
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={(!inputValue.trim() && attachments.length === 0) || isTyping}>
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
      overdueInvoices: qbSummary.overdueInvoices.slice(0, 20).map(i => ({
        doc: i.DocNumber, customer: i.CustomerRef?.name, balance: i.Balance, due: i.DueDate,
      })),
      overdueBills: qbSummary.overdueBills.slice(0, 20).map(b => ({
        doc: b.DocNumber, vendor: b.VendorRef?.name, balance: b.Balance, due: b.DueDate,
      })),
      bankAccounts: qbSummary.accounts
        .filter(a => a.AccountType === "Bank")
        .map(a => ({ name: a.Name, balance: a.CurrentBalance })),
      recentPayments: qbSummary.payments.slice(0, 10).map(p => ({
        amount: p.TotalAmt, date: p.TxnDate,
      })),
      unpaidInvoiceCount: qbSummary.invoices.filter(i => i.Balance > 0).length,
      unpaidBillCount: qbSummary.bills.filter(b => b.Balance > 0).length,
      pennySuggestions: pennySuggestions.slice(0, 10).map(s => ({
        title: s.title, description: s.description, impact: s.impact, severity: s.severity, category: s.category,
      })),
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
});
AccountingAgent.displayName = "AccountingAgent";
