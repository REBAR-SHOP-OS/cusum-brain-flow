import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MentionMenu } from "@/components/chat/MentionMenu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Phone, Mail, Calendar, ArrowRight,
  Send, Clock, CheckCircle2, Loader2, Paperclip,
  PhoneCall, FileText, Zap, Download, File, FileSpreadsheet, Image, ClipboardList,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { useToast } from "@/hooks/use-toast";
import { OdooImagePreview as OdooImagePreviewInline } from "./OdooImagePreview";
import { StorageImagePreview } from "./StorageImagePreview";
import DOMPurify from "dompurify";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadActivity = Tables<"lead_activities">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface OdooChatterProps {
  lead: LeadWithCustomer;
}

// ── Thread filter type ─────────────────────────────────────────────
type ThreadFilter = "all" | "conversation" | "audit";

// ── Icon / color maps ──────────────────────────────────────────────
const activityIcons: Record<string, React.ElementType> = {
  note: MessageSquare,
  call: PhoneCall,
  email: Mail,
  meeting: Calendar,
  stage_change: ArrowRight,
  follow_up: Clock,
  internal_task: FileText,
  comment: MessageSquare,
  system: Zap,
};

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Helpers for email quote stripping ──────────────────────────────
function splitEmailQuotes(html: string): { main: string; quoted: string | null } {
  // Common quote patterns
  const patterns = [
    /(<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*$)/i,
    /(-----\s*Original Message\s*-----[\s\S]*$)/i,
    /(<blockquote[^>]*>[\s\S]*<\/blockquote>\s*$)/i,
    /(On\s+.{10,80}\s+wrote:\s*[\s\S]*$)/i,
    /(From:\s+.{5,80}\s*Sent:\s+[\s\S]*$)/i,
  ];
  for (const pat of patterns) {
    const match = html.match(pat);
    if (match && match.index && match.index > 50) {
      return { main: html.slice(0, match.index), quoted: html.slice(match.index) };
    }
  }
  return { main: html, quoted: null };
}

// ── Check if an activity is "system noise" ─────────────────────────
function isSystemNoise(activity: LeadActivity): boolean {
  const type = activity.activity_type;
  if (type !== "stage_change" && type !== "system") return false;
  const meta = (activity.metadata as any) || {};
  const hasTracking = meta.tracking_changes && Array.isArray(meta.tracking_changes) && meta.tracking_changes.length > 0;
  const hasBody = !!(activity as any).body_html;
  return !hasTracking && !hasBody;
}

// ── Check if an activity is "conversation" (email, note, comment, comm) ─
function isConversationType(kind: string, activityType?: string): boolean {
  if (kind === "comm") return true;
  if (kind === "file_group") return true;
  if (activityType === "email" || activityType === "note" || activityType === "comment" || activityType === "internal_task") return true;
  return false;
}

function isAuditType(activityType?: string): boolean {
  return activityType === "stage_change" || activityType === "system";
}

// ── Recognized useful event types from lead_events ─────────────────
const USEFUL_EVENT_TYPES = new Set([
  "stage_changed", "value_changed", "contact_linked", "note_added",
  "owner_changed", "priority_changed", "tag_added", "tag_removed",
]);

// ── Component ──────────────────────────────────────────────────────
export function OdooChatter({ lead }: OdooChatterProps) {
  const [activeTab, setActiveTab] = useState<"note" | "message" | "activity" | null>(null);
  const [composerText, setComposerText] = useState("");
  const [activityType, setActivityType] = useState("follow_up");
  const [activityDate, setActivityDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("all");

  const handleComposerChange = (val: string) => {
    setComposerText(val);
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) { setMentionOpen(true); setMentionFilter(atMatch[1]); setMentionIndex(0); }
    else { setMentionOpen(false); }
  };

  const handleMentionSelect = useCallback((item: { label: string }) => {
    setComposerText(prev => prev.replace(/@\w*$/, `@${item.label} `));
    setMentionOpen(false);
  }, []);

  const handleComposerKeyDown = (e: React.KeyboardEvent) => {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); }
    else if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); }
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const ALLOWED_TYPES = ["image/", "application/pdf", "application/msword", "application/vnd.openxmlformats", "application/vnd.ms-excel", "text/csv"];
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFileAttach = async (file: File) => {
    if (uploadingFile) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20MB", variant: "destructive" });
      return;
    }
    if (!ALLOWED_TYPES.some(t => file.type.startsWith(t))) {
      toast({ title: "Unsupported file type", description: "Please attach images, PDFs, or documents", variant: "destructive" });
      return;
    }
    setUploadingFile(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `lead-attachments/${lead.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await uploadToStorage("clearance-photos", path, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("lead_files").insert({
        lead_id: lead.id,
        company_id: lead.company_id,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        storage_path: path,
        source: "chatter_upload",
      });
      if (insertError) throw insertError;
      queryClient.invalidateQueries({ queryKey: ["lead-files-timeline", lead.id] });
      toast({ title: "File attached" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Queries ──────────────────────────────────────────────────────
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["lead-activities", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadActivity[];
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["lead-files-timeline", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_files")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: leadEvents = [] } = useQuery({
    queryKey: ["lead-events", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_events")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["lead-communications-chatter", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────
  const addActivityMutation = useMutation({
    mutationFn: async (activity: { activity_type: string; title: string; description?: string; completed_at?: string | null }) => {
      const { error } = await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        company_id: lead.company_id,
        activity_type: activity.activity_type,
        title: activity.title,
        description: activity.description || null,
        created_by: "You",
        completed_at: activity.completed_at ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      setComposerText("");
      setActiveTab(null);
      toast({ title: "Activity logged" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from("lead_activities")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      toast({ title: "Marked as done" });
    },
  });

  // ── Derived data ─────────────────────────────────────────────────
  const plannedActivities = useMemo(
    () => activities.filter((a) => !a.completed_at && ["follow_up", "call", "meeting", "email"].includes(a.activity_type)),
    [activities]
  );

  // Convert lead_events into activity-like items, deduplicating stage changes
  // Also suppress empty/noise "Odoo Sync" entries
  const eventActivities = useMemo(() => {
    const chatterStageTimestamps = new Set<string>();
    activities.forEach(a => {
      if (a.activity_type === "stage_change") {
        chatterStageTimestamps.add(new Date(a.created_at).toISOString().slice(0, 10));
      }
    });

    return leadEvents
      .filter((evt: any) => {
        // Skip lead_events stage changes if chatter already has stage_change activities
        if (evt.event_type === "stage_changed" && chatterStageTimestamps.size > 0) {
          return false;
        }
        // ── NOISE SUPPRESSION: filter out unrecognized event types with empty payloads ──
        if (!USEFUL_EVENT_TYPES.has(evt.event_type)) {
          const payload = (evt.payload as Record<string, unknown>) || {};
          const desc = evt.description || "";
          const payloadKeys = Object.keys(payload).filter(k => k !== "source" && k !== "timestamp");
          // If payload is empty/trivial and description is empty or just a company name, skip
          if (payloadKeys.length === 0 && (!desc || desc.length < 30)) {
            return false;
          }
        }
        return true;
      })
      .map((evt: any) => {
        const payload = (evt.payload as Record<string, unknown>) || {};
        let title = evt.event_type;
        let description = "";
        if (evt.event_type === "stage_changed") {
          title = "Stage changed";
          description = `${payload.from || "—"} → ${payload.to || "—"}`;
          if (payload.odoo_stage) description += ` (Odoo: ${payload.odoo_stage})`;
        } else if (evt.event_type === "value_changed") {
          title = "Value changed";
          description = `$${Number(payload.from || 0).toLocaleString()} → $${Number(payload.to || 0).toLocaleString()}`;
        } else if (evt.event_type === "contact_linked") {
          title = "Contact linked";
          description = String(payload.customer_name || "");
        } else if (evt.event_type === "note_added") {
          title = "Note from Odoo";
          description = String(payload.content || "");
        }
        return {
          id: evt.id,
          lead_id: evt.lead_id,
          activity_type: evt.event_type === "stage_changed" ? "stage_change" : "system",
          title,
          description,
          created_by: evt.source_system === "odoo_sync" ? "Odoo Sync" : "System",
          created_at: evt.created_at,
          completed_at: evt.created_at,
          company_id: lead.company_id,
        };
      });
  }, [leadEvents, activities, lead.company_id]);

  // Unified thread — files linked to their parent activity via odoo_message_id
  type ThreadItem =
    | { kind: "activity"; data: LeadActivity; matchedFiles?: any[]; date: Date }
    | { kind: "file_group"; files: any[]; label?: string; date: Date }
    | { kind: "comm"; data: (typeof communications)[0]; date: Date }
    | { kind: "system_group"; items: LeadActivity[]; date: Date };

  const thread = useMemo(() => {
    const completedActivities = activities.filter(
      (a) => a.completed_at || !["follow_up", "call", "meeting", "email"].includes(a.activity_type)
    );
    const allActivities = [
      ...completedActivities,
      ...eventActivities.map((a: any) => a as LeadActivity),
    ];

    // Build map: odoo_message_id → files[]
    const filesByMsgId = new Map<number, any[]>();
    const orphanFiles: any[] = [];
    const unlinkedOdooFiles: any[] = [];
    for (const f of files) {
      const msgId = (f as any).odoo_message_id;
      if (msgId) {
        if (!filesByMsgId.has(msgId)) filesByMsgId.set(msgId, []);
        filesByMsgId.get(msgId)!.push(f);
      } else {
        const isOdooOrigin = (f as any).source === "odoo_sync" || (f as any).odoo_id;
        if (isOdooOrigin) {
          unlinkedOdooFiles.push(f);
        } else {
          orphanFiles.push(f);
        }
      }
    }

    // Separate system noise from real activities
    const realActivities: typeof allActivities = [];
    const noiseActivities: typeof allActivities = [];
    for (const a of allActivities) {
      if (isSystemNoise(a)) {
        noiseActivities.push(a);
      } else {
        realActivities.push(a);
      }
    }

    // Build activity items from real activities
    // Use odoo_created_at for ALL Odoo-synced activity dates when the activity's
    // created_at matches the sync timestamp (meaning it was bulk-created during sync)
    const leadOdooCreatedAt = (lead as any).odoo_created_at || ((lead.metadata as any)?.odoo_created_at);
    const syncedAt = (lead.metadata as any)?.synced_at;
    const items: ThreadItem[] = realActivities.map((a) => {
      const msgId = (a as any).odoo_message_id as number | undefined;
      const matched = msgId ? filesByMsgId.get(msgId) : undefined;

      // Determine the best date for this activity:
      // 1. If the activity has its own odoo-origin date in metadata, use that
      // 2. If the activity was created during sync (created_at ≈ synced_at), use odoo_created_at
      // 3. Otherwise use the activity's own created_at
      const actMeta = (a.metadata as any) || {};
      const actOdooDate = actMeta.odoo_date || actMeta.message_date;
      let actDate: Date;
      if (actOdooDate) {
        actDate = new Date(actOdooDate);
      } else if (leadOdooCreatedAt && syncedAt) {
        const createdMs = new Date(a.created_at).getTime();
        const syncMs = new Date(syncedAt).getTime();
        // If created within 60s of sync run, this is a sync-generated record
        if (Math.abs(createdMs - syncMs) < 60_000) {
          actDate = new Date(leadOdooCreatedAt);
        } else {
          actDate = new Date(a.created_at);
        }
      } else if (leadOdooCreatedAt) {
        // Fallback: if activity is a stage_change initial event, use odoo_created_at
        const isInitialEvent = a.activity_type === "stage_change" && (a.description?.startsWith("—") || a.description?.startsWith("null"));
        actDate = isInitialEvent ? new Date(leadOdooCreatedAt) : new Date(a.created_at);
      } else {
        actDate = new Date(a.created_at);
      }

      return {
        kind: "activity" as const,
        data: a,
        matchedFiles: matched,
        date: actDate,
      };
    });

    items.push(...communications.map((c) => ({ kind: "comm" as const, data: c, date: new Date(c.created_at) })));

    // Group noise activities into collapsed system_group items (consecutive by day)
    if (noiseActivities.length > 0) {
      const sorted = [...noiseActivities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      let batch: typeof sorted = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const prevDay = new Date(sorted[i - 1].created_at).toISOString().slice(0, 10);
        const curDay = new Date(sorted[i].created_at).toISOString().slice(0, 10);
        if (prevDay === curDay) {
          batch.push(sorted[i]);
        } else {
          items.push({ kind: "system_group", items: [...batch], date: new Date(batch[0].created_at) });
          batch = [sorted[i]];
        }
      }
      if (batch.length > 0) {
        items.push({ kind: "system_group", items: [...batch], date: new Date(batch[0].created_at) });
      }
    }

    // Group standalone files into batches by time proximity
    const pushFileBatches = (fileList: any[], label?: string) => {
      if (fileList.length === 0) return;
      const sorted = [...fileList].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      let batch: any[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].created_at).getTime();
        const cur = new Date(sorted[i].created_at).getTime();
        if (cur - prev <= 60_000) {
          batch.push(sorted[i]);
        } else {
          items.push({ kind: "file_group", files: [...batch], label, date: new Date(batch[0].created_at) });
          batch = [sorted[i]];
        }
      }
      if (batch.length > 0) {
        items.push({ kind: "file_group", files: [...batch], label, date: new Date(batch[0].created_at) });
      }
    };
    pushFileBatches(orphanFiles);
    pushFileBatches(unlinkedOdooFiles, "Unlinked Odoo Files");

    // Sort by date descending
    items.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Collapse consecutive generic stage-change duplicates (same author, same minute, no tracking)
    const collapsed: ThreadItem[] = [];
    for (const item of items) {
      if (item.kind === "activity" && item.data.activity_type === "stage_change") {
        const meta = (item.data.metadata as any) || {};
        const hasTracking = meta.tracking_changes && Array.isArray(meta.tracking_changes) && meta.tracking_changes.length > 0;
        const hasBody = !!(item.data as any).body_html;
        if (!hasTracking && !hasBody) {
          const prev = collapsed[collapsed.length - 1];
          if (prev && prev.kind === "activity" && prev.data.activity_type === "stage_change") {
            const prevMeta = (prev.data.metadata as any) || {};
            const prevHasTracking = prevMeta.tracking_changes && Array.isArray(prevMeta.tracking_changes) && prevMeta.tracking_changes.length > 0;
            if (!prevHasTracking && prev.data.created_by === item.data.created_by &&
                Math.abs(prev.date.getTime() - item.date.getTime()) < 120_000) {
              continue;
            }
          }
        }
      }
      collapsed.push(item);
    }
    return collapsed;
  }, [activities, eventActivities, files, communications]);

  // ── Filtered thread based on threadFilter ────────────────────────
  const filteredThread = useMemo(() => {
    if (threadFilter === "all") return thread;
    if (threadFilter === "conversation") {
      return thread.filter(item => {
        if (item.kind === "comm" || item.kind === "file_group") return true;
        if (item.kind === "activity") return isConversationType("activity", item.data.activity_type);
        if (item.kind === "system_group") return false;
        return true;
      });
    }
    // audit
    return thread.filter(item => {
      if (item.kind === "system_group") return true;
      if (item.kind === "activity") return isAuditType(item.data.activity_type);
      return false;
    });
  }, [thread, threadFilter]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleTabClick = (tab: "note" | "message" | "activity") => {
    setActiveTab((prev) => (prev === tab ? null : tab));
    setComposerText("");
  };

  const handleSubmit = () => {
    if (activeTab === "activity") {
      addActivityMutation.mutate({
        activity_type: activityType,
        title: `${activityType.charAt(0).toUpperCase() + activityType.slice(1).replace("_", " ")} scheduled`,
        description: composerText || undefined,
        completed_at: null,
      });
    } else {
      const isNote = activeTab === "note";
      addActivityMutation.mutate({
        activity_type: isNote ? "note" : "email",
        title: isNote ? "Note added" : "Message sent",
        description: composerText,
        completed_at: new Date().toISOString(),
      });
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* ── Composer Tab Bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        {(["note", "message", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={cn(
              "px-3 py-1.5 text-[13px] font-medium rounded-sm transition-colors",
              activeTab === tab
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "note" ? "Log note" : tab === "message" ? "Send message" : "Schedule activity"}
          </button>
        ))}
      </div>

      {/* ── Composer Body ────────────────────────────────────────── */}
      {activeTab && (
        <div className={cn(
          "border-b border-border p-3 space-y-2",
          activeTab === "note" && "bg-amber-50/60 dark:bg-amber-950/20"
        )}>
          {activeTab === "activity" && (
            <div className="flex gap-2">
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-36 h-8 text-xs"
              />
            </div>
          )}
          <div className="relative">
            <Textarea
              value={composerText}
              onChange={(e) => handleComposerChange(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                activeTab === "note"
                  ? "Log an internal note..."
                  : activeTab === "message"
                  ? "Write a message..."
                  : "Add a description..."
              }
              className={cn("min-h-[60px] text-[13px] resize-none", activeTab === "note" && "bg-transparent border-amber-300/50 dark:border-amber-700/50")}
            />
            <MentionMenu
              isOpen={mentionOpen}
              filter={mentionFilter}
              selectedIndex={mentionIndex}
              onSelect={handleMentionSelect}
              onClose={() => setMentionOpen(false)}
            />
          </div>
          <div className="flex items-center justify-between">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileAttach(f);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
              {uploadingFile ? "Uploading..." : "Attach"}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSubmit}
              disabled={!composerText.trim() && activeTab !== "activity" || addActivityMutation.isPending}
            >
              <Send className="w-3 h-3" />
              {activeTab === "note" ? "Log" : activeTab === "message" ? "Send" : "Schedule"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Planned Activities ───────────────────────────────────── */}
      {plannedActivities.length > 0 && (
        <div className="border-b border-border">
          <div className="px-3 py-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Planned Activities
            </h4>
            <div className="space-y-1.5">
              {plannedActivities.map((activity) => {
                const Icon = activityIcons[activity.activity_type] || Clock;
                const dueDate = new Date(activity.created_at);
                const overdue = isBefore(dueDate, startOfDay(new Date()));
                const today = isToday(dueDate);

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors group"
                  >
                    <div className={cn(
                      "mt-0.5 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded",
                      overdue
                        ? "bg-destructive/10 text-destructive"
                        : today
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "bg-green-500/10 text-green-600 dark:text-green-400"
                    )}>
                      {format(dueDate, "MMM d")}
                    </div>
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">{activity.created_by || "Unassigned"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                        onClick={() => markDoneMutation.mutate(activity.id)}
                        disabled={markDoneMutation.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Done
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Thread Filter Tabs ───────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 pt-1">
        {([
          { key: "all" as const, label: "All" },
          { key: "conversation" as const, label: "Conversation" },
          { key: "audit" as const, label: "Audit" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setThreadFilter(key)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors",
              threadFilter === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Message Thread ───────────────────────────────────────── */}
      <div className="px-3 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filteredThread.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="w-16 h-16 text-muted-foreground/20 mb-3" />
            <p className="text-[13px] text-muted-foreground">
              {threadFilter === "all" ? "No activities yet." : `No ${threadFilter} entries.`}
            </p>
            {threadFilter === "all" && (
              <p className="text-[13px] text-muted-foreground">
                Log a note or schedule an activity above.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredThread.map((item, idx) => {
              const prevDate = idx > 0 ? filteredThread[idx - 1].date : null;
              const showDateSep = !prevDate || format(item.date, "yyyy-MM-dd") !== format(prevDate, "yyyy-MM-dd");
              const key = item.kind === "file_group"
                ? `files-${item.files[0]?.id || idx}`
                : item.kind === "comm"
                ? `comm-${item.data.id}`
                : item.kind === "system_group"
                ? `sysgrp-${idx}`
                : `act-${item.data.id}`;

              return (
                <div key={key} className="border-b border-border last:border-b-0">
                  {showDateSep && <DateSeparator date={item.date} />}
                  {item.kind === "file_group" ? (
                    <FileGroupThreadItem files={item.files} label={item.label} />
                  ) : item.kind === "comm" ? (
                    <CommThreadItem comm={item.data} />
                  ) : item.kind === "system_group" ? (
                    <SystemGroupItem items={item.items} />
                  ) : (
                    <ActivityThreadItem activity={item.data} matchedFiles={item.matchedFiles} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function DateSeparator({ date }: { date: Date }) {
  const now = new Date();
  const isDateToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const label = isDateToday ? "Today" : isYesterday ? "Yesterday" : format(date, "MMMM d, yyyy");

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Collapsed system/audit group ───────────────────────────────────
function SystemGroupItem({ items }: { items: LeadActivity[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="py-1.5 px-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Zap className="w-3 h-3" />
        <span>
          {items.length} system update{items.length > 1 ? "s" : ""}
        </span>
        <span className="text-[10px] ml-auto">
          {format(new Date(items[0].created_at), "h:mm a")}
        </span>
      </button>
      {expanded && (
        <div className="ml-5 mt-1 space-y-0.5 border-l border-border pl-2">
          {items.map((item) => (
            <div key={item.id} className="text-[11px] text-muted-foreground flex items-center gap-1.5 py-0.5">
              <span className="font-medium">{item.title}</span>
              {item.description && <span>— {item.description}</span>}
              <span className="ml-auto text-[10px]">{format(new Date(item.created_at), "h:mm a")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ActivityThreadItem = React.memo(
  React.forwardRef<HTMLDivElement, { activity: LeadActivity; matchedFiles?: any[] }>(function ActivityThreadItem({ activity, matchedFiles }, ref) {
    const Icon = activityIcons[activity.activity_type] || MessageSquare;
    const isNote = activity.activity_type === "note";
    const isStageChange = activity.activity_type === "stage_change";
    const isEmail = activity.activity_type === "email";
    const author = activity.created_by || "System";
    const [htmlExpanded, setHtmlExpanded] = useState(false);
    const [quotedExpanded, setQuotedExpanded] = useState(false);

    // Extract body_html and tracking_changes from the activity
    const metadata = (activity.metadata as any) || {};
    const bodyHtml = (activity as any).body_html || metadata.body_html || null;
    const trackingChanges = metadata.tracking_changes as Array<{ field: string; old_value: string; new_value: string }> | undefined;
    const hasTracking = trackingChanges && trackingChanges.length > 0;

    const sanitizedHtml = useMemo(() => {
      if (!bodyHtml) return null;
      let html = DOMPurify.sanitize(bodyHtml, {
        ALLOWED_TAGS: ["p", "br", "b", "i", "u", "strong", "em", "a", "ul", "ol", "li", "span", "div", "table", "tr", "td", "th", "thead", "tbody", "h1", "h2", "h3", "h4", "blockquote", "img", "hr", "pre", "code"],
        ALLOWED_ATTR: ["href", "target", "style", "class", "src", "alt", "width", "height", "colspan", "rowspan"],
      });
      // Proxy Odoo-hosted images through our edge function so they load with auth
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        html = html.replace(
          /(<img\s[^>]*src=")([^"]*odoo[^"]*\/web\/image\/[^"]*)(")/gi,
          (_match, prefix, odooUrl, suffix) => {
            const proxied = `${supabaseUrl}/functions/v1/odoo-file-proxy?url=${encodeURIComponent(odooUrl)}`;
            return `${prefix}${proxied}${suffix}`;
          }
        );
      }
      return html;
    }, [bodyHtml]);

    // Split email content into main + quoted portions
    const emailParts = useMemo(() => {
      if (!isEmail || !sanitizedHtml) return null;
      return splitEmailQuotes(sanitizedHtml);
    }, [isEmail, sanitizedHtml]);

    return (
      <div ref={ref} className={cn(
        "flex gap-3 p-3 rounded-md transition-colors hover:bg-accent/50",
        isNote && "bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-amber-400 dark:border-amber-600"
      )}>
        <Avatar className="w-8 h-8 shrink-0 text-[11px]">
          <AvatarFallback className="bg-primary/10 text-primary text-[11px]">
            {getInitials(author)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold truncate">{author}</span>
              {isEmail && <Mail className="w-3 h-3 text-muted-foreground shrink-0" />}
              {isStageChange && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
              {format(new Date(activity.created_at), "h:mm a")}
            </span>
          </div>

          {/* Email subject header */}
          {isEmail && activity.title && activity.title !== "Email" && (
            <p className="text-[13px] font-medium mt-0.5">{activity.title}</p>
          )}

          {/* Stage change: show description or parse from metadata description */}
          {isStageChange && !hasTracking && (() => {
            const desc = activity.description && activity.description !== activity.title
              ? activity.description
              : (metadata.description && /→|->/.test(metadata.description))
                ? metadata.description
                : null;
            return desc ? <p className="text-[13px] mt-0.5 text-muted-foreground">{desc}</p> : null;
          })()}

          {/* Tracking changes — field change bullets like Odoo */}
          {hasTracking && (
            <ul className="mt-1 space-y-0.5">
              {trackingChanges!.map((tc, i) => (
                <li key={i} className="text-[12px] flex items-start gap-1">
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium text-foreground">{tc.field}</span>
                  <span className="text-muted-foreground">:</span>
                  {tc.old_value && (
                    <>
                      <span className="text-red-500 line-through">{tc.old_value}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                    </>
                  )}
                  <span className="text-green-600 dark:text-green-400">{tc.new_value}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Rich HTML body — emails get 3-line preview + expand; non-emails show full */}
          {isEmail && emailParts ? (
            <div className="mt-1.5 rounded border border-border bg-card p-2.5">
              <div
                className={cn(
                  "odoo-html-body text-[13px] text-foreground/80 leading-relaxed overflow-hidden",
                  !htmlExpanded && "line-clamp-3"
                )}
                dangerouslySetInnerHTML={{ __html: emailParts.main }}
              />
              {!htmlExpanded && (
                <button
                  onClick={() => setHtmlExpanded(true)}
                  className="text-[11px] text-primary hover:underline mt-1"
                >
                  Show full email
                </button>
              )}
              {htmlExpanded && (
                <>
                  {emailParts.quoted && (
                    <div className="mt-2 border-t border-border pt-2">
                      <button
                        onClick={() => setQuotedExpanded(!quotedExpanded)}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {quotedExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Quoted reply
                      </button>
                      {quotedExpanded && (
                        <div
                          className="odoo-html-body text-[12px] text-muted-foreground leading-relaxed mt-1 pl-2 border-l-2 border-muted"
                          dangerouslySetInnerHTML={{ __html: emailParts.quoted }}
                        />
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => { setHtmlExpanded(false); setQuotedExpanded(false); }}
                    className="text-[11px] text-primary hover:underline mt-1"
                  >
                    Hide
                  </button>
                </>
              )}
            </div>
          ) : sanitizedHtml ? (
            <div className="mt-1.5 rounded border border-border bg-card p-2.5">
              <div
                className={cn(
                  "odoo-html-body text-[13px] text-foreground/80 leading-relaxed overflow-hidden",
                  !htmlExpanded && sanitizedHtml.length > 1500 && "max-h-[500px]"
                )}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
              {sanitizedHtml.length > 1500 && (
                <button
                  onClick={() => setHtmlExpanded(!htmlExpanded)}
                  className="text-[11px] text-primary hover:underline mt-1"
                >
                  {htmlExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          ) : activity.description && !hasTracking ? (
            <div className="text-[13px] text-foreground/80 whitespace-pre-wrap mt-0.5 leading-relaxed">
              {renderDescriptionWithFiles(activity.description)}
            </div>
          ) : (
            !isStageChange && !hasTracking && (
              <p className="text-[13px] text-foreground/80 mt-0.5">{activity.title}</p>
            )
          )}

          {/* Inline file attachments matched by odoo_message_id */}
          {matchedFiles && matchedFiles.length > 0 && (
            <InlineFileAttachments files={matchedFiles} />
          )}
        </div>
      </div>
    );
  })
);

function InlineFileAttachments({ files }: { files: any[] }) {
  const imageFiles = files.filter(f => f.mime_type?.startsWith("image/") && !f.mime_type?.includes("dwg"));
  const nonImageFiles = files.filter(f => !f.mime_type?.startsWith("image/") || f.mime_type?.includes("dwg"));

  return (
    <div className="mt-2 space-y-2">
      {imageFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {imageFiles.map((file) => {
            const isOdooFile = !file.storage_path && file.odoo_id;
            const isStorageFile = !!file.storage_path;
            const hasFileUrl = !isOdooFile && !isStorageFile && file.file_url;
            return (
              <div key={file.id} className="space-y-1">
                {isOdooFile && (
                  <OdooImagePreviewInline odooId={file.odoo_id} fileName={file.file_name || "image"} thumbnail />
                )}
                {isStorageFile && (
                  <StorageImagePreview storagePath={file.storage_path} fileName={file.file_name || "image"} thumbnail />
                )}
                {hasFileUrl && (
                  <img
                    src={file.file_url}
                    alt={file.file_name || "image"}
                    className="w-16 h-16 rounded-md border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(file.file_url, "_blank")}
                  />
                )}
                <p className="text-[10px] text-muted-foreground truncate">{file.file_name}</p>
              </div>
            );
          })}
        </div>
      )}
      {nonImageFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {nonImageFiles.map((file) => {
            const ext = file.file_name?.split(".").pop()?.toUpperCase() || "FILE";
            const FileIconComp = getFileIcon(file.mime_type || "", ext);
            const iconColor = getFileIconColor(ext);
            return (
              <button
                key={file.id}
                onClick={async () => {
                  if (file.storage_path) {
                    const url = await getSignedFileUrl(file.storage_path);
                    if (url) window.open(url, "_blank");
                  } else if (file.odoo_id) {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) return;
                      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/odoo-file-proxy?id=${file.odoo_id}`;
                      const res = await fetch(proxyUrl, {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      window.open(blobUrl, "_blank");
                    } catch (e) {
                      console.error("Odoo file download error:", e);
                    }
                  } else if (file.file_url) {
                    window.open(file.file_url, "_blank");
                  }
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-secondary/50 hover:bg-secondary transition-colors text-left max-w-[200px]"
              >
                <FileIconComp className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
                <span className="text-[11px] font-medium truncate">{file.file_name}</span>
                <Download className="w-3 h-3 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FileGroupThreadItem({ files, label }: { files: any[]; label?: string }) {
  return (
    <div className="flex gap-3 p-3 hover:bg-accent/50 rounded-md transition-colors">
      <Avatar className="w-8 h-8 shrink-0 text-[11px]">
        <AvatarFallback className="bg-muted text-muted-foreground text-[11px]">
          <Paperclip className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold truncate">
            {label ? `${label} (${files.length})` : `${files.length} file${files.length > 1 ? "s" : ""} attached`}
          </span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {format(new Date(files[0].created_at), "h:mm a")}
          </span>
        </div>
        {label && (
          <p className="text-[11px] text-muted-foreground mt-0.5">These files could not be linked to a specific message</p>
        )}
        <InlineFileAttachments files={files} />
      </div>
    </div>
  );
}

const COMM_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  call: PhoneCall,
  meeting: Calendar,
  note: FileText,
  sms: MessageSquare,
};

function CommThreadItem({ comm }: { comm: any }) {
  const Icon = COMM_ICONS[comm.comm_type] || MessageSquare;
  const author = comm.created_by_name || comm.contact_name || "Unknown";

  return (
    <div className="flex gap-3 p-3 rounded-md transition-colors hover:bg-accent/50">
      <Avatar className="w-8 h-8 shrink-0 text-[11px]">
        <AvatarFallback className="bg-primary/10 text-primary text-[11px]">
          {getInitials(author)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold truncate">{author}</span>
            <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] capitalize text-muted-foreground">{comm.comm_type}</span>
            {comm.direction && (
              <span className={cn(
                "text-[10px] px-1.5 rounded",
                comm.direction === "inbound" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"
              )}>
                {comm.direction}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {format(new Date(comm.created_at), "h:mm a")}
          </span>
        </div>
        {comm.subject && <p className="text-[13px] font-medium mt-0.5">{comm.subject}</p>}
        {comm.body_preview && (
          <p className="text-[13px] text-foreground/80 whitespace-pre-wrap mt-0.5 leading-relaxed line-clamp-3">
            {comm.body_preview}
          </p>
        )}
        {comm.contact_name && comm.contact_email && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {comm.contact_name} · {comm.contact_email}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────
function getFileIcon(mime: string, ext: string) {
  if (mime.startsWith("image/")) return Image;
  if (["XLS", "XLSX", "CSV"].includes(ext)) return FileSpreadsheet;
  if (ext === "PDF") return FileText;
  return File;
}

function getFileIconColor(ext: string): string {
  if (["XLS", "XLSX", "CSV"].includes(ext)) return "text-green-600";
  if (ext === "PDF") return "text-red-500";
  if (["DWG", "DXF"].includes(ext)) return "text-cyan-500";
  if (["PNG", "JPG", "JPEG", "GIF"].includes(ext)) return "text-blue-500";
  return "text-muted-foreground";
}
