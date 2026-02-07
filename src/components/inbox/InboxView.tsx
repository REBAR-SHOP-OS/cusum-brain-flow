import { useState, useMemo, useCallback, useEffect } from "react";
import { RefreshCw, Settings, Loader2, Search, CheckSquare, Trash2, Archive, X, Mail, LogOut } from "lucide-react";
import { InboxEmailList, type InboxEmail } from "./InboxEmailList";
import { InboxEmailViewer } from "./InboxEmailViewer";
import { InboxManagerSettings } from "./InboxManagerSettings";
import { InboxAIToolbar, type AIAction } from "./InboxAIToolbar";
import { InboxSummaryPanel, type InboxSummary } from "./InboxSummaryPanel";
import { useCommunications } from "@/hooks/useCommunications";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Categorization ────────────────────────────────────────────────
function categorizeEmail(from: string, subject: string, preview: string): { label: string; labelColor: string; priority: number } {
  const fromLower = from.toLowerCase();
  const subjectLower = (subject || "").toLowerCase();

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

// ─── Label filter options ──────────────────────────────────────────
const labelFilters = [
  { label: "All", value: "all" },
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
  const { communications, loading, sync } = useCommunications({ typeFilter: "email" });
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortByPriority, setSortByPriority] = useState(false);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Gmail connection state
  const [gmailStatus, setGmailStatus] = useState<"loading" | "connected" | "not_connected">("loading");
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Check if current user has Gmail connected
  useEffect(() => {
    const checkGmailStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-oauth", {
          body: { action: "check-status", integration: "gmail" },
        });
        if (error) {
          setGmailStatus("not_connected");
          return;
        }
        if (data?.status === "connected") {
          setGmailStatus("connected");
          setGmailEmail(data.email || userEmail);
        } else {
          setGmailStatus("not_connected");
        }
      } catch {
        setGmailStatus("not_connected");
      }
    };
    checkGmailStatus();
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
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Could not start Gmail connection",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await supabase.functions.invoke("google-oauth", {
        body: { action: "disconnect", integration: "gmail" },
      });
      setGmailStatus("not_connected");
      setGmailEmail(null);
      toast({ title: "Gmail disconnected" });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    }
  };

  // Map communications to InboxEmail format
  const allEmails: (InboxEmail & { priority: number })[] = useMemo(() => {
    return communications.map((comm) => {
      const category = categorizeEmail(comm.from, comm.subject || "", comm.preview || "");
      const meta = comm.metadata as Record<string, unknown> | null;
      const fullBody = (meta?.body as string) || comm.preview || "";
      const receivedDate = comm.receivedAt ? new Date(comm.receivedAt) : null;

      return {
        id: comm.id,
        sender: extractSenderName(comm.from),
        senderEmail: extractEmail(comm.from),
        toAddress: comm.to,
        subject: comm.subject || "(no subject)",
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
      };
    });
  }, [communications]);

  // Filter + sort
  const emails = useMemo(() => {
    let filtered = allEmails.filter((e) => !hiddenIds.has(e.id));

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.sender.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q)
      );
    }

    if (activeFilter !== "all") {
      filtered = filtered.filter((e) => e.label === activeFilter);
    }

    if (sortByPriority) {
      filtered = [...filtered].sort((a, b) => a.priority - b.priority);
    }

    return filtered;
  }, [allEmails, search, activeFilter, sortByPriority, hiddenIds]);

  // Label counts
  const labelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEmails.forEach((e) => {
      counts[e.label] = (counts[e.label] || 0) + 1;
    });
    return counts;
  }, [allEmails]);

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

  const handleDeleteEmail = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (selectedEmail?.id === id) setSelectedEmail(null);
    toast({ title: "Email deleted", description: "Email has been removed from your inbox." });
  }, [selectedEmail, toast]);

  const handleArchiveEmail = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (selectedEmail?.id === id) setSelectedEmail(null);
    toast({ title: "Email archived", description: "Email has been archived." });
  }, [selectedEmail, toast]);

  const handleBulkDelete = useCallback(() => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    if (selectedEmail && selectedIds.has(selectedEmail.id)) setSelectedEmail(null);
    toast({ title: "Bulk delete", description: `${selectedIds.size} email(s) deleted.` });
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, selectedEmail, toast]);

  const handleBulkArchive = useCallback(() => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    if (selectedEmail && selectedIds.has(selectedEmail.id)) setSelectedEmail(null);
    toast({ title: "Bulk archive", description: `${selectedIds.size} email(s) archived.` });
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, selectedEmail, toast]);

  // AI Actions handler
  const handleAIAction = async (action: AIAction) => {
    switch (action) {
      case "summarize": {
        const toRespond = allEmails.filter((e) => e.label === "To Respond" || e.label === "Urgent").length;
        const fyi = allEmails.filter((e) => e.label === "FYI" || e.label === "Awaiting Reply").length;
        const marketing = allEmails.filter((e) => e.label === "Marketing").length;
        const spam = allEmails.filter((e) => e.label === "Spam").length;

        const highlights: string[] = [];
        if (toRespond > 0) highlights.push(`${toRespond} email(s) need your reply — prioritize these first.`);
        const urgentEmails = allEmails.filter((e) => e.label === "Urgent");
        if (urgentEmails.length > 0) {
          highlights.push(`Urgent: "${urgentEmails[0].subject}" from ${urgentEmails[0].sender}`);
        }
        if (marketing > 3) highlights.push(`${marketing} marketing emails — consider archiving them.`);
        if (spam > 0) highlights.push(`${spam} suspected spam email(s) detected.`);
        if (fyi > 0) highlights.push(`${fyi} informational email(s) — read when you have time.`);

        setSummary({
          totalEmails: allEmails.length,
          toRespond,
          fyi,
          marketing,
          spam,
          highlights,
        });
        break;
      }

      case "detect-spam": {
        const spamCount = allEmails.filter((e) => e.label === "Spam").length;
        if (spamCount === 0) {
          const spamKeywords = ["alibaba", "unsubscribe", "free trial", "act now", "limited time", "congratulations", "winner"];
          const detected = allEmails.filter((e) =>
            spamKeywords.some((kw) =>
              e.subject.toLowerCase().includes(kw) || e.sender.toLowerCase().includes(kw)
            )
          );
          if (detected.length > 0) {
            setHiddenIds(new Set(detected.map((e) => e.id)));
          }
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
        setHiddenIds((prev) => {
          const next = new Set(prev);
          marketingEmails.forEach((e) => next.add(e.id));
          return next;
        });
        break;
      }

      case "unsubscribe": {
        setActiveFilter("Marketing");
        break;
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Email List Panel */}
      <div className={cn(
        "bg-background border-r flex flex-col min-h-0",
        selectedEmail ? "hidden md:flex md:w-[400px]" : "flex w-full md:w-[400px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Inbox</h1>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={selectionMode ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={toggleSelectMode}
              title={selectionMode ? "Exit selection" : "Select emails"}
            >
              {selectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Gmail connection banner */}
        {gmailStatus === "not_connected" && (
          <div className="px-3 py-3 border-b bg-muted/50">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Connect your Gmail</p>
                <p className="text-xs text-muted-foreground">Sign in to sync your emails</p>
              </div>
              <Button size="sm" onClick={handleConnectGmail} disabled={connecting}>
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
              </Button>
            </div>
          </div>
        )}

        {gmailStatus === "connected" && gmailEmail && (
          <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              <Mail className="w-3 h-3 inline mr-1" />
              {gmailEmail}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleDisconnectGmail}
              title="Disconnect Gmail"
            >
              <LogOut className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* AI Toolbar */}
        <InboxAIToolbar emailCount={allEmails.length} onAction={handleAIAction} />

        {/* Summary Panel */}
        <InboxSummaryPanel summary={summary} onClose={() => setSummary(null)} />

        {/* Search */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emails..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto">
          {labelFilters.map((f) => {
            const count = f.value === "all" ? allEmails.length : (labelCounts[f.value] || 0);
            if (f.value !== "all" && count === 0) return null;
            return (
              <button
                key={f.value}
                onClick={() => {
                  setActiveFilter(f.value);
                  setHiddenIds(new Set());
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
                  activeFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {f.color && <span className={cn("w-2 h-2 rounded-full", f.color)} />}
                {f.label}
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Hidden items banner */}
        {hiddenIds.size > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-warning/10 border-b text-xs">
            <span className="text-warning-foreground">{hiddenIds.size} email(s) hidden by AI cleanup</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6"
              onClick={() => setHiddenIds(new Set())}
            >
              Show all
            </Button>
          </div>
        )}

        {/* Email Count */}
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b flex items-center justify-between">
          {selectionMode ? (
            <div className="flex items-center gap-2 w-full">
              <Checkbox
                checked={emails.length > 0 && selectedIds.size === emails.length}
                onCheckedChange={selectAll}
              />
              <span className="text-xs font-medium">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : "Select all"}
              </span>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={handleBulkArchive}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <span>{emails.length} email{emails.length !== 1 ? "s" : ""}</span>
              {sortByPriority && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] h-5 px-1.5"
                  onClick={() => setSortByPriority(false)}
                >
                  Clear sort
                </Button>
              )}
            </>
          )}
        </div>

        {/* Email List */}
        <InboxEmailList
          emails={emails}
          selectedId={selectedEmail?.id ?? null}
          onSelect={setSelectedEmail}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectId}
          onDelete={handleDeleteEmail}
          onArchive={handleArchiveEmail}
        />
      </div>

      {/* Email Viewer */}
      <div className={cn(
        "flex-1 min-h-0",
        selectedEmail ? "flex" : "hidden md:flex"
      )}>
        <InboxEmailViewer
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      </div>

      {/* Settings Panel */}
      <InboxManagerSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        connectedEmail={userEmail}
      />
    </div>
  );
}
