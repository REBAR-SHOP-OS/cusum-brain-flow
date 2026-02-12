import { useState, useMemo, useCallback, useEffect, useLayoutEffect } from "react";
import {
  RefreshCw, Settings, Loader2, Search, CheckSquare,
  Trash2, Archive, X, Mail, LogOut, Phone, LayoutGrid,
  List, MessageSquare, Wifi, WifiOff, PenSquare
} from "lucide-react";
import { InboxEmailList, type InboxEmail } from "./InboxEmailList";
import { InboxEmailViewer } from "./InboxEmailViewer";
import { InboxDetailView } from "./InboxDetailView";
import { InboxManagerSettings } from "./InboxManagerSettings";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { InboxAIToolbar, type AIAction } from "./InboxAIToolbar";
import { InboxSummaryPanel, type InboxSummary } from "./InboxSummaryPanel";
import { InboxKanbanBoard } from "./InboxKanbanBoard";
import { useCommunications } from "@/hooks/useCommunications";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Categorization ────────────────────────────────────────────────
// AI category → label/color mapping
function aiCategoryToLabel(category: string, urgency: string): { label: string; labelColor: string; priority: number } {
  switch (category) {
    case "RFQ": return { label: urgency === "high" ? "Urgent" : "To Respond", labelColor: urgency === "high" ? "bg-red-500" : "bg-red-400", priority: urgency === "high" ? 0 : 1 };
    case "Active Customer": return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
    case "Payment": return { label: "FYI", labelColor: "bg-amber-400", priority: 2 };
    case "Vendor": return { label: "Awaiting Reply", labelColor: "bg-amber-400", priority: 3 };
    case "Internal": return { label: "Notification", labelColor: "bg-cyan-400", priority: 4 };
    case "Marketing": return { label: "Marketing", labelColor: "bg-pink-400", priority: 5 };
    case "Spam": return { label: "Spam", labelColor: "bg-gray-500", priority: 6 };
    default: return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
  }
}

function categorizeCommunication(
  from: string,
  subject: string,
  preview: string,
  type: "email" | "call" | "sms",
  aiCategory?: string | null,
  aiUrgency?: string | null,
): { label: string; labelColor: string; priority: number } {
  // Use AI classification if available
  if (aiCategory) {
    return aiCategoryToLabel(aiCategory, aiUrgency || "medium");
  }

  // Fallback to keyword-based
  const fromLower = from.toLowerCase();
  const subjectLower = (subject || "").toLowerCase();
  const previewLower = (preview || "").toLowerCase();

  if (type === "call") {
    if (subjectLower.includes("missed")) return { label: "Urgent", labelColor: "bg-red-500", priority: 0 };
    return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
  }
  if (type === "sms") {
    if (subjectLower.includes("urgent") || previewLower.includes("urgent") || previewLower.includes("asap")) {
      return { label: "Urgent", labelColor: "bg-red-500", priority: 0 };
    }
    return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
  }

  if (fromLower.includes("mailer-daemon") || fromLower.includes("postmaster") || subjectLower.includes("delivery status")) {
    return { label: "Notification", labelColor: "bg-cyan-400", priority: 4 };
  }
  if (fromLower.includes("noreply") || fromLower.includes("no-reply") || fromLower.includes("newsletter") || fromLower.includes("marketing")) {
    return { label: "Marketing", labelColor: "bg-pink-400", priority: 5 };
  }
  if (subjectLower.includes("security") || subjectLower.includes("access code") || subjectLower.includes("verification")) {
    return { label: "Notification", labelColor: "bg-cyan-400", priority: 4 };
  }
  if (subjectLower.includes("invoice") || subjectLower.includes("payment") || subjectLower.includes("transfer")) {
    return { label: "FYI", labelColor: "bg-amber-400", priority: 2 };
  }
  if (subjectLower.includes("support case") || subjectLower.includes("ticket")) {
    return { label: "Awaiting Reply", labelColor: "bg-amber-400", priority: 3 };
  }
  if (subjectLower.includes("urgent") || subjectLower.includes("asap") || subjectLower.includes("important")) {
    return { label: "Urgent", labelColor: "bg-red-500", priority: 0 };
  }
  if (subjectLower.includes("spam") || fromLower.includes("alibaba") || subjectLower.includes("unsubscribe")) {
    return { label: "Spam", labelColor: "bg-gray-500", priority: 6 };
  }
  return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
}

function extractSenderName(fromAddress: string): string {
  const match = fromAddress.match(/^([^<]+)</);
  if (match) return match[1].trim();
  const emailMatch = fromAddress.match(/([^@]+)@/);
  if (emailMatch) return emailMatch[1].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return fromAddress;
}

function extractEmail(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  if (match) return match[1];
  return fromAddress;
}

const labelFilters = [
  { label: "All", value: "all" },
  { label: "⭐ Starred", value: "starred" },
  { label: "Follow-up", value: "follow-up", color: "bg-orange-400" },
  { label: "To Respond", value: "To Respond", color: "bg-red-400" },
  { label: "Urgent", value: "Urgent", color: "bg-red-500" },
  { label: "FYI", value: "FYI", color: "bg-amber-400" },
  { label: "Awaiting Reply", value: "Awaiting Reply", color: "bg-amber-400" },
  { label: "Notification", value: "Notification", color: "bg-cyan-400" },
  { label: "Marketing", value: "Marketing", color: "bg-pink-400" },
  { label: "Spam", value: "Spam", color: "bg-gray-500" },
];

// ─── Component ─────────────────────────────────────────────────────
interface InboxViewProps {
  connectedEmail?: string;
}

export function InboxView({ connectedEmail }: InboxViewProps) {
  const { user } = useAuth();
  const userEmail = connectedEmail || user?.email || "unknown";
  const { communications, loading, sync } = useCommunications();
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortByPriority, setSortByPriority] = useState(false);
  // Default to list view on mobile, kanban on desktop
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState<"list" | "kanban">(isMobile ? "list" : "kanban");
  const [kanbanTypeFilter, setKanbanTypeFilter] = useState<"all" | "email" | "call" | "sms">("all");
  const [summary, setSummary] = useState<InboxSummary | null>(null);
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
  const allEmails: (InboxEmail & { priority: number; commType: "email" | "call" | "sms" })[] = useMemo(() => {
    return communications.map((comm) => {
      const commType: "email" | "call" | "sms" = comm.type;
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
        // AI fields
        aiCategory: comm.aiCategory,
        aiUrgency: comm.aiUrgency,
        aiActionRequired: comm.aiActionRequired,
        aiActionSummary: comm.aiActionSummary,
        aiDraft: comm.aiDraft,
        aiPriorityData: comm.aiPriorityData,
        resolvedAt: comm.resolvedAt,
      };
    });
  }, [communications]);

  // Follow-up nudge IDs (emails > 48h old with no outbound reply)
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
    if (selectedEmail?.id === id) setSelectedEmail(null);
    try {
      await supabase.from("communications").delete().eq("id", id);
      toast({ title: "Email deleted", description: "Email has been permanently removed." });
      logActivity(id, "email_deleted", `Deleted email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "delete" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }, [selectedEmail, toast, allEmails, logActivity]);

  const handleArchiveEmail = useCallback(async (id: string) => {
    const email = allEmails.find((e) => e.id === id);
    setHiddenIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    if (selectedEmail?.id === id) setSelectedEmail(null);
    try {
      await supabase.from("communications").update({ status: "archived" }).eq("id", id);
      toast({ title: "Email archived" });
      logActivity(id, "email_archived", `Archived email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "archive" });
    } catch {
      toast({ title: "Archive failed", variant: "destructive" });
    }
  }, [selectedEmail, toast, allEmails, logActivity]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setHiddenIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    if (selectedEmail && selectedIds.has(selectedEmail.id)) setSelectedEmail(null);
    try {
      await supabase.from("communications").delete().in("id", ids);
      toast({ title: "Bulk delete", description: `${ids.length} email(s) deleted.` });
      ids.forEach((id) => {
        const email = allEmails.find((e) => e.id === id);
        logActivity(id, "email_deleted", `Deleted email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "bulk_delete" });
      });
    } catch {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, selectedEmail, toast, allEmails, logActivity]);

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setHiddenIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    if (selectedEmail && selectedIds.has(selectedEmail.id)) setSelectedEmail(null);
    try {
      await supabase.from("communications").update({ status: "archived" }).in("id", ids);
      toast({ title: "Bulk archive", description: `${ids.length} email(s) archived.` });
      ids.forEach((id) => {
        const email = allEmails.find((e) => e.id === id);
        logActivity(id, "email_archived", `Archived email from ${email?.sender || "unknown"}: ${email?.subject || "(no subject)"}`, { sender: email?.sender, subject: email?.subject, action: "bulk_archive" });
      });
    } catch {
      toast({ title: "Bulk archive failed", variant: "destructive" });
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, selectedEmail, toast, allEmails, logActivity]);

  // ─── Keyboard shortcuts (desktop only) ────────────────────────────
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
        // Call relay-pipeline edge function
        const { data, error } = await supabase.functions.invoke("relay-pipeline", {
          body: { action: "process" },
        });
        if (error) throw error;
        toast({ title: "Relay Pipeline", description: `Processed ${data?.processed || 0} emails with AI.` });
        // Refresh communications
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

  // Count unprocessed emails for Relay badge
  const unprocessedCount = useMemo(() => {
    return communications.filter(c => !c.aiProcessedAt && c.direction === "inbound").length;
  }, [communications]);

  const gmailConnected = gmailStatus === "connected";
  const rcConnected = rcStatus === "connected";
  const bothLoading = gmailStatus === "loading" && rcStatus === "loading";

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* ─── Single Unified Toolbar ─── */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 rounded-none"
              onClick={() => setViewMode("kanban")}
              title="Kanban view"
            >
              <LayoutGrid className="w-3 h-3" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 rounded-none"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="w-3 h-3" />
            </Button>
          </div>

          {/* Compose button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-6 gap-1 text-[11px] px-2"
                onClick={() => setShowCompose(true)}
              >
                <PenSquare className="w-3 h-3" />
                Compose
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Compose new email (c)</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="w-px h-4 bg-border shrink-0" />

          {/* AI actions inline */}
          <InboxAIToolbar emailCount={allEmails.length} onAction={handleAIAction} unprocessedCount={unprocessedCount} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search — inline expandable */}
          {showSearch ? (
            <div className="relative max-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-6 pl-7 pr-6 text-[11px]"
                autoFocus
                onBlur={() => { if (!search) setShowSearch(false); }}
              />
              {search && (
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => { setSearch(""); setShowSearch(false); }}>
                  <X className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSearch(true)}>
                  <Search className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Search</TooltipContent>
            </Tooltip>
          )}

          {/* Connection status dots */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                {bothLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className={cn("w-1.5 h-1.5 rounded-full", gmailConnected ? "bg-emerald-400" : "bg-muted-foreground/40")} />
                    <div className={cn("w-1.5 h-1.5 rounded-full", rcConnected ? "bg-blue-400" : "bg-muted-foreground/40")} />
                  </>
                )}
                <Wifi className="w-3 h-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Connections</p>
              <div className="flex items-center gap-2">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", gmailConnected ? "bg-emerald-500/15" : "bg-muted")}>
                  <Mail className={cn("w-3 h-3", gmailConnected ? "text-emerald-400" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium">Gmail</p>
                  <p className="text-[9px] text-muted-foreground truncate">{gmailConnected ? gmailEmail : "Not connected"}</p>
                </div>
                {gmailConnected ? (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-destructive" onClick={handleDisconnectGmail}>
                    <LogOut className="w-2.5 h-2.5" />
                  </Button>
                ) : (
                  <Button size="sm" className="h-5 px-2 text-[9px]" onClick={handleConnectGmail} disabled={connecting}>
                    {connecting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Connect"}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", rcConnected ? "bg-blue-500/15" : "bg-muted")}>
                  <Phone className={cn("w-3 h-3", rcConnected ? "text-blue-400" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium">RingCentral</p>
                  <p className="text-[9px] text-muted-foreground truncate">{rcConnected ? rcEmail : "Not connected"}</p>
                </div>
                {rcConnected ? (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-destructive" onClick={handleDisconnectRC}>
                    <LogOut className="w-2.5 h-2.5" />
                  </Button>
                ) : (
                  <Button size="sm" className="h-5 px-2 text-[9px]" onClick={handleConnectRC} disabled={rcConnecting}>
                    {rcConnecting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Connect"}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Utility actions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectionMode ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={toggleSelectMode}
              >
                {selectionMode ? <X className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{selectionMode ? "Exit selection" : "Select"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Sync</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(true)}>
                <Settings className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Settings</TooltipContent>
          </Tooltip>
        </div>

        {/* Summary panel (appears below toolbar when triggered) */}
        <InboxSummaryPanel summary={summary} onClose={() => setSummary(null)} />

        {/* ─── List-only extras: filter chips ─── */}
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
            <InboxDetailView email={selectedEmail} onClose={() => setSelectedEmail(null)} onDelete={handleDeleteEmail} onArchive={handleArchiveEmail} />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Type filter tabs for Kanban */}
              <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border shrink-0">
                {([
                  { value: "all" as const, label: "All", icon: null, count: allEmails.filter(e => !hiddenIds.has(e.id)).length },
                  { value: "email" as const, label: "Email", icon: <Mail className="w-3.5 h-3.5" />, count: allEmails.filter(e => !hiddenIds.has(e.id) && e.commType === "email").length },
                  { value: "call" as const, label: "Calls", icon: <Phone className="w-3.5 h-3.5" />, count: allEmails.filter(e => !hiddenIds.has(e.id) && e.commType === "call").length },
                  { value: "sms" as const, label: "SMS", icon: <MessageSquare className="w-3.5 h-3.5" />, count: allEmails.filter(e => !hiddenIds.has(e.id) && e.commType === "sms").length },
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
                  emails={allEmails.filter((e) => !hiddenIds.has(e.id) && !snoozedUntil.has(e.id) && (kanbanTypeFilter === "all" || e.commType === kanbanTypeFilter))}
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
              {/* Email Count + selection bar */}
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b flex items-center justify-between">
                {selectionMode ? (
                  <div className="flex items-center gap-2 w-full">
                    <Checkbox checked={emails.length > 0 && selectedIds.size === emails.length} onCheckedChange={selectAll} />
                    <span className="text-xs font-medium">
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
                  </div>
                ) : (
                  <>
                    <span>{emails.length} email{emails.length !== 1 ? "s" : ""}</span>
                    {sortByPriority && (
                      <Button variant="ghost" size="sm" className="text-[11px] h-5 px-1.5" onClick={() => setSortByPriority(false)}>Clear sort</Button>
                    )}
                  </>
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

            {/* Email Viewer */}
            <div className={cn("flex-1 min-h-0", selectedEmail ? "flex" : "hidden md:flex")}>
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

        {/* Settings Panel */}
        <InboxManagerSettings open={showSettings} onOpenChange={setShowSettings} connectedEmail={userEmail} />

        {/* Compose Dialog */}
        <ComposeEmailDialog open={showCompose} onOpenChange={setShowCompose} />
      </div>
    </TooltipProvider>
  );
}
