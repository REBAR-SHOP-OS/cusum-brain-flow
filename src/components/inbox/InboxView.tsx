import { useState, useMemo, useCallback, useEffect, useLayoutEffect } from "react";
import {
  Trash2, Archive, X, Mail, Phone,
  MessageSquare, FileText, Volume2
} from "lucide-react";
import { InboxEmailList, type InboxEmail } from "./InboxEmailList";
import { InboxDetailView } from "./InboxDetailView";
import { InboxManagerSettings } from "./InboxManagerSettings";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import type { AIAction } from "./InboxAIToolbar";
import { InboxSummaryPanel, type InboxSummary } from "./InboxSummaryPanel";
import { InboxKanbanBoard } from "./InboxKanbanBoard";
import { InboxToolbar } from "./InboxToolbar";
import { SendFaxDialog } from "./SendFaxDialog";
import { BulkSMSDialog } from "./BulkSMSDialog";
import { SMSTemplateManager } from "./SMSTemplateManager";
import { CallAnalyticsDashboard } from "./CallAnalyticsDashboard";
import { EmailAnalyticsDashboard } from "./EmailAnalyticsDashboard";
import {
  categorizeCommunication,
  extractSenderName,
  extractEmail,
  labelFilters,
} from "./inboxCategorization";
import { useCommunications } from "@/hooks/useCommunications";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Component ─────────────────────────────────────────────────────
interface InboxViewProps {
  connectedEmail?: string;
}

export function InboxView({ connectedEmail }: InboxViewProps) {
  const { user } = useAuth();
  const userEmail = connectedEmail || user?.email || "unknown";
  const { communications, loading, sync, refresh } = useCommunications();
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortByPriority, setSortByPriority] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState<"list" | "kanban">(isMobile ? "list" : "kanban");
  const [kanbanTypeFilter, setKanbanTypeFilter] = useState<"all" | "email" | "call" | "sms" | "voicemail" | "fax">("all");
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [showFaxDialog, setShowFaxDialog] = useState(false);
  const [showBulkSMS, setShowBulkSMS] = useState(false);
  const [showSMSTemplates, setShowSMSTemplates] = useState(false);
  const [showCallAnalytics, setShowCallAnalytics] = useState(false);
  const [showEmailAnalytics, setShowEmailAnalytics] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [snoozedUntil, setSnoozedUntil] = useState<Map<string, Date>>(new Map());
  const [showCompose, setShowCompose] = useState(false);
  const { toast } = useToast();

  // Toggle star
  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Snooze handler
  const handleSnoozeEmail = useCallback((id: string, until: Date) => {
    setSnoozedUntil((prev) => {
      const next = new Map(prev);
      next.set(id, until);
      return next;
    });
  }, []);

  // Un-snooze emails whose time has passed
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setSnoozedUntil((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, until] of next) {
          if (until <= now) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Gmail connection state
  const [gmailStatus, setGmailStatus] = useState<"loading" | "connected" | "not_connected">("loading");
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // RingCentral connection state
  const [rcStatus, setRcStatus] = useState<"loading" | "connected" | "not_connected">("loading");
  const [rcEmail, setRcEmail] = useState<string | null>(null);
  const [rcConnecting, setRcConnecting] = useState(false);

  // Check connection statuses
  useEffect(() => {
    const checkGmailStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-oauth", {
          body: { action: "check-status", integration: "gmail" },
        });
        if (error) { setGmailStatus("not_connected"); return; }
        if (data?.status === "connected") {
          setGmailStatus("connected");
          setGmailEmail(data.email || userEmail);
        } else {
          setGmailStatus("not_connected");
        }
      } catch { setGmailStatus("not_connected"); }
    };

    const checkRcStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ringcentral-oauth", {
          body: { action: "check-status" },
        });
        if (error) { setRcStatus("not_connected"); return; }
        if (data?.status === "connected") {
          setRcStatus("connected");
          setRcEmail(data.email || null);
        } else {
          setRcStatus("not_connected");
        }
      } catch { setRcStatus("not_connected"); }
    };

    checkGmailStatus();
    checkRcStatus();
  }, [userEmail]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/integrations/callback`;
      const { data, error } = await supabase.functions.invoke("google-oauth", {
        body: { action: "get-auth-url", integration: "gmail", redirectUri },
      });
      if (error) throw new Error(error.message);
      window.location.href = data.authUrl;
    } catch (err) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Could not start Gmail connection", variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await supabase.functions.invoke("google-oauth", { body: { action: "disconnect", integration: "gmail" } });
      setGmailStatus("not_connected");
      setGmailEmail(null);
      toast({ title: "Gmail disconnected" });
    } catch { toast({ title: "Failed to disconnect", variant: "destructive" }); }
  };

  const handleConnectRC = async () => {
    setRcConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/integrations/callback`;
      const { data, error } = await supabase.functions.invoke("ringcentral-oauth", {
        body: { action: "get-auth-url", redirectUri },
      });
      if (error) throw new Error(error.message);
      window.location.href = data.authUrl;
    } catch (err) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Could not start RingCentral connection", variant: "destructive" });
      setRcConnecting(false);
    }
  };

  const handleDisconnectRC = async () => {
    try {
      await supabase.functions.invoke("ringcentral-oauth", { body: { action: "disconnect" } });
      setRcStatus("not_connected");
      setRcEmail(null);
      toast({ title: "RingCentral disconnected" });
    } catch { toast({ title: "Failed to disconnect", variant: "destructive" }); }
  };

  // Map communications to InboxEmail format
  const allEmails: (InboxEmail & { priority: number; commType: "email" | "call" | "sms" | "voicemail" | "fax" })[] = useMemo(() => {
    const mapped = communications.map((comm) => {
      const commType = comm.type;
      const category = categorizeCommunication(comm.from, comm.subject || "", comm.preview || "", commType, comm.aiCategory, comm.aiUrgency);
      const meta = comm.metadata as Record<string, unknown> | null;
      const fullBody = (meta?.body as string) || comm.preview || "";
      const receivedDate = comm.receivedAt ? new Date(comm.receivedAt) : null;

      let displaySubject = comm.subject || "(no subject)";
      if (commType === "call") {
        const duration = meta?.duration as string | undefined;
        displaySubject = `${comm.direction === "inbound" ? "Incoming" : "Outgoing"} Call${duration ? ` (${duration})` : ""}`;
      } else if (commType === "sms") {
        displaySubject = comm.preview || "SMS message";
      }

      return {
        id: comm.id,
        sender: extractSenderName(comm.from),
        senderEmail: extractEmail(comm.from),
        toAddress: comm.to,
        subject: displaySubject,
        preview: comm.preview || "",
        body: fullBody,
        time: receivedDate ? format(receivedDate, "h:mm a") : "",
        fullDate: receivedDate ? format(receivedDate, "MMM d, h:mm a") : "",
        label: category.label,
        labelColor: category.labelColor,
        isUnread: comm.status === "unread",
        threadId: comm.threadId || undefined,
        sourceId: comm.sourceId,
        priority: category.priority,
        commType,
        aiCategory: comm.aiCategory,
        aiUrgency: comm.aiUrgency,
        aiActionRequired: comm.aiActionRequired,
        aiActionSummary: comm.aiActionSummary,
        aiDraft: comm.aiDraft,
        aiPriorityData: comm.aiPriorityData,
        resolvedAt: comm.resolvedAt,
      };
    });

    // Collapse SMS threads
    const smsThreadMap = new Map<string, typeof mapped[number][]>();
    const result: typeof mapped = [];

    for (const item of mapped) {
      if (item.commType === "sms" && item.threadId) {
        const key = item.threadId;
        if (!smsThreadMap.has(key)) smsThreadMap.set(key, []);
        smsThreadMap.get(key)!.push(item);
      } else {
        result.push(item);
      }
    }

    for (const [, group] of smsThreadMap) {
      const representative = group[0];
      const hasUnread = group.some((m) => m.isUnread);
      const count = group.length;
      result.push({
        ...representative,
        isUnread: hasUnread,
        subject: count > 1
          ? `${representative.preview || "SMS message"} (${count} messages)`
          : representative.preview || "SMS message",
        preview: representative.preview || "",
      });
    }

    return result;
  }, [communications]);

  // Follow-up nudge IDs
  const followUpIds = useMemo(() => {
    const now = Date.now();
    const _48h = 48 * 60 * 60 * 1000;
    const ids = new Set<string>();
    allEmails.forEach((e) => {
      if (e.label === "To Respond" || e.label === "Urgent") {
        const received = e.fullDate ? new Date(e.fullDate).getTime() : 0;
        if (received && now - received > _48h) {
          ids.add(e.id);
        }
      }
    });
    return ids;
  }, [allEmails]);

  // Filter + sort
  const emails = useMemo(() => {
    let filtered = allEmails.filter((e) => !hiddenIds.has(e.id) && !snoozedUntil.has(e.id));

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.sender.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q)
      );
    }

    if (activeFilter === "starred") {
      filtered = filtered.filter((e) => starredIds.has(e.id));
    } else if (activeFilter === "follow-up") {
      filtered = filtered.filter((e) => followUpIds.has(e.id));
    } else if (activeFilter !== "all") {
      filtered = filtered.filter((e) => e.label === activeFilter);
    }

    if (sortByPriority) {
      filtered = [...filtered].sort((a, b) => a.priority - b.priority);
    }

    return filtered;
  }, [allEmails, search, activeFilter, sortByPriority, hiddenIds, snoozedUntil, starredIds, followUpIds]);

  // Label counts
  const labelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEmails.forEach((e) => {
      counts[e.label] = (counts[e.label] || 0) + 1;
    });
    counts["starred"] = starredIds.size;
    counts["follow-up"] = followUpIds.size;
    return counts;
  }, [allEmails, starredIds.size, followUpIds.size]);

  const handleSync = async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  };

  // ─── Selection handlers ────────────────────────────────────────────
  const toggleSelectMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  }, [emails, selectedIds.size]);

  const logActivity = useCallback(async (entityId: string, eventType: string, description: string, metadata: Record<string, unknown>) => {
    try {
      await supabase.from("activity_events").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        entity_type: "communication",
        entity_id: entityId,
        event_type: eventType,
        description,
        source: "user",
        metadata: metadata as any,
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  }, []);

  const handleDeleteEmail = useCallback(async (id: string) => {
    const email = allEmails.find((e) => e.id === id);
    setHiddenIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    setSelectedEmail(prev => prev?.id === id ? null : prev);
    try {
      if (email?.sourceId) {
        const { error: gmailErr } = await supabase.functions.invoke("gmail-delete", {
          body: { messageId: email.sourceId },
        });
        if (gmailErr) {
          toast({ title: "Warning", description: "Could not remove from Gmail — it may reappear on next sync.", variant: "destructive" });
        }
      }
      await supabase.from("communications").delete().eq("id", id);
      toast({ title: "Email deleted", description: "Email has been permanently removed." });
      logActivity(id, "email_deleted", `Deleted email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "delete" });
      await refresh();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }, [toast, allEmails, logActivity, refresh]);

  const handleArchiveEmail = useCallback(async (id: string) => {
    const email = allEmails.find((e) => e.id === id);
    setHiddenIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    setSelectedEmail(prev => prev?.id === id ? null : prev);
    try {
      await supabase.from("communications").update({ status: "archived" }).eq("id", id);
      toast({ title: "Email archived" });
      logActivity(id, "email_archived", `Archived email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "archive" });
      await refresh();
    } catch {
      toast({ title: "Archive failed", variant: "destructive" });
    }
  }, [toast, allEmails, logActivity, refresh]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setHiddenIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setSelectedEmail(prev => prev && selectedIds.has(prev.id) ? null : prev);
    try {
      const gmailDeletes = ids
        .map((id) => allEmails.find((e) => e.id === id))
        .filter((e) => e?.sourceId)
        .map((e) => supabase.functions.invoke("gmail-delete", { body: { messageId: e!.sourceId } }));
      await Promise.allSettled(gmailDeletes);

      await supabase.from("communications").delete().in("id", ids);
      toast({ title: "Bulk delete", description: `${ids.length} email(s) deleted.` });
      ids.forEach((id) => {
        const email = allEmails.find((e) => e.id === id);
        logActivity(id, "email_deleted", `Deleted email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "bulk_delete" });
      });
      await refresh();
    } catch {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, toast, allEmails, logActivity, refresh]);

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setHiddenIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setSelectedEmail(prev => prev && selectedIds.has(prev.id) ? null : prev);
    try {
      await supabase.from("communications").update({ status: "archived" }).in("id", ids);
      toast({ title: "Bulk archive", description: `${ids.length} email(s) archived.` });
      ids.forEach((id) => {
        const email = allEmails.find((e) => e.id === id);
        logActivity(id, "email_archived", `Archived email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "bulk_archive" });
      });
      await refresh();
    } catch {
      toast({ title: "Bulk archive failed", variant: "destructive" });
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, toast, allEmails, logActivity, refresh]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case "j": {
          const idx = emails.findIndex((em) => em.id === selectedEmail?.id);
          if (idx < emails.length - 1) setSelectedEmail(emails[idx + 1]);
          break;
        }
        case "k": {
          const idx = emails.findIndex((em) => em.id === selectedEmail?.id);
          if (idx > 0) setSelectedEmail(emails[idx - 1]);
          break;
        }
        case "e":
          if (selectedEmail) handleArchiveEmail(selectedEmail.id);
          break;
        case "s":
          if (selectedEmail) toggleStar(selectedEmail.id);
          break;
        case "/":
          e.preventDefault();
          setShowSearch(true);
          break;
        case "Escape":
          if (selectedEmail) setSelectedEmail(null);
          else if (showSearch) { setSearch(""); setShowSearch(false); }
          break;
        case "c":
          setShowCompose(true);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [emails, selectedEmail, handleArchiveEmail, toggleStar, showSearch]);


  const handleAIAction = async (action: AIAction) => {
    switch (action) {
      case "run-relay": {
        const { data, error } = await supabase.functions.invoke("relay-pipeline", {
          body: { action: "process" },
        });
        if (error) throw error;
        toast({ title: "Relay Pipeline", description: `Processed ${data?.processed || 0} emails with AI.` });
        await sync();
        return;
      }
      case "summarize": {
        const toRespond = allEmails.filter((e) => e.label === "To Respond" || e.label === "Urgent").length;
        const fyi = allEmails.filter((e) => e.label === "FYI" || e.label === "Awaiting Reply").length;
        const marketing = allEmails.filter((e) => e.label === "Marketing").length;
        const spam = allEmails.filter((e) => e.label === "Spam").length;
        const highlights: string[] = [];
        if (toRespond > 0) highlights.push(`${toRespond} email(s) need your reply — prioritize these first.`);
        const urgentEmails = allEmails.filter((e) => e.label === "Urgent");
        if (urgentEmails.length > 0) highlights.push(`Urgent: "${urgentEmails[0].subject}" from ${urgentEmails[0].sender}`);
        if (marketing > 3) highlights.push(`${marketing} marketing emails — consider archiving them.`);
        if (spam > 0) highlights.push(`${spam} suspected spam email(s) detected.`);
        if (fyi > 0) highlights.push(`${fyi} informational email(s) — read when you have time.`);
        setSummary({ totalEmails: allEmails.length, toRespond, fyi, marketing, spam, highlights });
        break;
      }
      case "detect-spam": {
        const spamCount = allEmails.filter((e) => e.label === "Spam").length;
        if (spamCount === 0) {
          const spamKeywords = ["alibaba", "unsubscribe", "free trial", "act now", "limited time", "congratulations", "winner"];
          const detected = allEmails.filter((e) => spamKeywords.some((kw) => e.subject.toLowerCase().includes(kw) || e.sender.toLowerCase().includes(kw)));
          if (detected.length > 0) setHiddenIds(new Set(detected.map((e) => e.id)));
        }
        setActiveFilter("Spam");
        break;
      }
      case "clean": {
        const clutter = allEmails.filter((e) => e.label === "Marketing" || e.label === "Spam");
        setHiddenIds(new Set(clutter.map((e) => e.id)));
        break;
      }
      case "prioritize":
        setSortByPriority(true);
        break;
      case "label-all":
        setActiveFilter("all");
        setSortByPriority(false);
        setHiddenIds(new Set());
        break;
      case "archive-marketing": {
        const marketingEmails = allEmails.filter((e) => e.label === "Marketing");
        setHiddenIds((prev) => { const next = new Set(prev); marketingEmails.forEach((e) => next.add(e.id)); return next; });
        break;
      }
      case "unsubscribe":
        setActiveFilter("Marketing");
        break;
    }
  };

  const unprocessedCount = useMemo(() => {
    return communications.filter(c => !c.aiProcessedAt && c.direction === "inbound").length;
  }, [communications]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Unified Toolbar (extracted component) */}
        <InboxToolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          onCompose={() => setShowCompose(true)}
          onFax={() => setShowFaxDialog(true)}
          onBulkSMS={() => setShowBulkSMS(true)}
          onCallAnalytics={() => setShowCallAnalytics(true)}
          onEmailAnalytics={() => setShowEmailAnalytics(true)}
          emailCount={allEmails.length}
          unprocessedCount={unprocessedCount}
          onAIAction={handleAIAction}
          search={search}
          setSearch={setSearch}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          selectionMode={selectionMode}
          toggleSelectMode={toggleSelectMode}
          syncing={syncing}
          onSync={handleSync}
          onSettings={() => setShowSettings(true)}
          gmailStatus={gmailStatus}
          gmailEmail={gmailEmail}
          rcStatus={rcStatus}
          rcEmail={rcEmail}
          onConnectGmail={handleConnectGmail}
          onDisconnectGmail={handleDisconnectGmail}
          onConnectRC={handleConnectRC}
          onDisconnectRC={handleDisconnectRC}
          connecting={connecting}
          rcConnecting={rcConnecting}
        />

        {/* Summary panel */}
        <InboxSummaryPanel summary={summary} onClose={() => setSummary(null)} />

        {/* List-only filter chips */}
        {viewMode === "list" && (
          <div className="shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b overflow-x-auto">
              {labelFilters.map((f) => {
                const count = f.value === "all" ? allEmails.length : (labelCounts[f.value] || 0);
                if (f.value !== "all" && count === 0) return null;
                return (
                  <button
                    key={f.value}
                    onClick={() => { setActiveFilter(f.value); setHiddenIds(new Set()); }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
                      activeFilter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {f.color && <span className={cn("w-2 h-2 rounded-full", f.color)} />}
                    {f.label}
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{count}</Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden items banner */}
        {hiddenIds.size > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-warning/10 border-b text-xs shrink-0">
            <span className="text-warning-foreground">{hiddenIds.size} email(s) hidden by AI cleanup</span>
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setHiddenIds(new Set())}>Show all</Button>
          </div>
        )}

        {/* Snoozed items banner */}
        {snoozedUntil.size > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-b text-xs shrink-0">
            <span className="text-muted-foreground">{snoozedUntil.size} email(s) snoozed</span>
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setSnoozedUntil(new Map())}>Show all</Button>
          </div>
        )}

        {viewMode === "kanban" ? (
          selectedEmail ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <InboxDetailView email={selectedEmail} onClose={() => setSelectedEmail(null)} onDelete={handleDeleteEmail} onArchive={handleArchiveEmail} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Type filter tabs for Kanban */}
              <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border shrink-0">
                {([
                  { value: "all" as const, label: "All", icon: null, count: emails.length },
                  { value: "email" as const, label: "Email", icon: <Mail className="w-3.5 h-3.5" />, count: emails.filter(e => e.commType === "email").length },
                  { value: "call" as const, label: "Calls", icon: <Phone className="w-3.5 h-3.5" />, count: emails.filter(e => e.commType === "call").length },
                  { value: "sms" as const, label: "SMS", icon: <MessageSquare className="w-3.5 h-3.5" />, count: emails.filter(e => e.commType === "sms").length },
                  { value: "voicemail" as const, label: "Voicemail", icon: <Volume2 className="w-3.5 h-3.5" />, count: emails.filter(e => e.commType === "voicemail").length },
                  { value: "fax" as const, label: "Fax", icon: <FileText className="w-3.5 h-3.5" />, count: emails.filter(e => e.commType === "fax").length },
                ]).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setKanbanTypeFilter(tab.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      kanbanTypeFilter === tab.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    <Badge variant={kanbanTypeFilter === tab.value ? "outline" : "secondary"} className={cn("text-[10px] h-4 px-1.5 ml-0.5", kanbanTypeFilter === tab.value && "border-primary-foreground/30 text-primary-foreground")}>
                      {tab.count}
                    </Badge>
                  </button>
                ))}
              </div>
              <div className="flex-1 flex overflow-hidden">
                <InboxKanbanBoard
                  emails={emails.filter((e) => kanbanTypeFilter === "all" || e.commType === kanbanTypeFilter)}
                  onSelect={setSelectedEmail}
                  selectedId={selectedEmail?.id ?? null}
                  starredIds={starredIds}
                  onToggleStar={toggleStar}
                />
              </div>
            </div>
          )
        ) : (
          /* ── List View ── */
          <div className="flex-1 flex overflow-hidden">
            <div className={cn(
              "bg-background border-r flex flex-col min-h-0",
              selectedEmail ? "hidden md:flex md:w-[400px]" : "flex w-full md:w-[400px]"
            )}>
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b flex items-center gap-2">
                <Checkbox
                  checked={selectionMode && emails.length > 0 && selectedIds.size === emails.length}
                  onCheckedChange={() => {
                    if (!selectionMode) {
                      setSelectionMode(true);
                      setSelectedIds(new Set(emails.map(e => e.id)));
                    } else {
                      selectAll();
                    }
                  }}
                />
                {selectionMode ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium whitespace-nowrap">
                      {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                    </span>
                    {selectedIds.size > 0 && (
                      <div className="flex items-center gap-1 ml-auto">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleBulkDelete}>
                          <Trash2 className="w-3.5 h-3.5" />Delete
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleBulkArchive}>
                          <Archive className="w-3.5 h-3.5" />Archive
                        </Button>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] ml-auto" onClick={toggleSelectMode}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span>{emails.length} email{emails.length !== 1 ? "s" : ""}</span>
                    {sortByPriority && (
                      <Button variant="ghost" size="sm" className="text-[11px] h-5 px-1.5" onClick={() => setSortByPriority(false)}>Clear sort</Button>
                    )}
                  </div>
                )}
              </div>

              <InboxEmailList
                emails={emails}
                selectedId={selectedEmail?.id ?? null}
                onSelect={setSelectedEmail}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectId}
                onDelete={handleDeleteEmail}
                onArchive={handleArchiveEmail}
                starredIds={starredIds}
                onToggleStar={toggleStar}
              />
            </div>

            <div className={cn("flex-1 min-h-0 overflow-hidden", selectedEmail ? "flex" : "hidden md:flex")}>
              {selectedEmail ? (
                <InboxDetailView email={selectedEmail} onClose={() => setSelectedEmail(null)} onDelete={handleDeleteEmail} onArchive={handleArchiveEmail} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 w-full">
                  <Mail className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Select an email to read</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dialogs */}
        <InboxManagerSettings open={showSettings} onOpenChange={setShowSettings} connectedEmail={userEmail} />
        <ComposeEmailDialog open={showCompose} onOpenChange={setShowCompose} />
        <SendFaxDialog open={showFaxDialog} onOpenChange={setShowFaxDialog} />
        <BulkSMSDialog open={showBulkSMS} onOpenChange={setShowBulkSMS} />
        <SMSTemplateManager open={showSMSTemplates} onOpenChange={setShowSMSTemplates} />
        <CallAnalyticsDashboard open={showCallAnalytics} onOpenChange={setShowCallAnalytics} />
        <EmailAnalyticsDashboard open={showEmailAnalytics} onOpenChange={setShowEmailAnalytics} />
      </div>
    </TooltipProvider>
  );
}
