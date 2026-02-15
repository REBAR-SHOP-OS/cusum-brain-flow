import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Phone, Mail, Calendar, ArrowRight,
  Send, Clock, CheckCircle2, Loader2, Paperclip,
  PhoneCall, FileText, Zap, Download, File, FileSpreadsheet, Image,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadActivity = Tables<"lead_activities">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface OdooChatterProps {
  lead: LeadWithCustomer;
}

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

// ── Component ──────────────────────────────────────────────────────
export function OdooChatter({ lead }: OdooChatterProps) {
  const [activeTab, setActiveTab] = useState<"note" | "message" | "activity" | null>(null);
  const [composerText, setComposerText] = useState("");
  const [activityType, setActivityType] = useState("follow_up");
  const [activityDate, setActivityDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Convert lead_events into activity-like items
  const eventActivities = useMemo(() => leadEvents.map((evt: any) => {
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
      completed_at: evt.created_at, // events are always "done"
      company_id: lead.company_id,
    };
  }), [leadEvents, lead.company_id]);

  // Unified thread (completed activities + events + files), newest first
  type ThreadItem =
    | { kind: "activity"; data: LeadActivity; date: Date }
    | { kind: "file"; data: (typeof files)[0]; date: Date };

  const thread = useMemo(() => {
    const completedActivities = activities.filter(
      (a) => a.completed_at || !["follow_up", "call", "meeting", "email"].includes(a.activity_type)
    );
    const items: ThreadItem[] = [
      ...completedActivities.map((a) => ({ kind: "activity" as const, data: a, date: new Date(a.created_at) })),
      ...eventActivities.map((a: any) => ({ kind: "activity" as const, data: a as LeadActivity, date: new Date(a.created_at) })),
      ...files.map((f) => ({ kind: "file" as const, data: f, date: new Date(f.created_at) })),
    ];
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [activities, eventActivities, files]);

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
    <div className="space-y-0">
      {/* ── Composer Tab Bar ─────────────────────────────────────── */}
      <div className="flex items-center border-b border-border">
        {(["note", "message", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={cn(
              "px-3 py-2 text-[13px] font-medium transition-colors relative",
              activeTab === tab
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "note" ? "Log note" : tab === "message" ? "Send message" : "Schedule activity"}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
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
          <Textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={
              activeTab === "note"
                ? "Log an internal note..."
                : activeTab === "message"
                ? "Write a message..."
                : "Add a description..."
            }
            className={cn("min-h-[60px] text-[13px] resize-none", activeTab === "note" && "bg-transparent border-amber-300/50 dark:border-amber-700/50")}
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              Attach
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

      {/* ── Message Thread ───────────────────────────────────────── */}
      <div className="px-3 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : thread.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-8">
            No activities yet. Log a note or schedule an activity above.
          </p>
        ) : (
          <div className="space-y-0">
            {thread.map((item, idx) => {
              const prevDate = idx > 0 ? thread[idx - 1].date : null;
              const showDateSep = !prevDate || format(item.date, "yyyy-MM-dd") !== format(prevDate, "yyyy-MM-dd");

              return (
                <div key={item.kind === "file" ? `file-${item.data.id}` : item.data.id}>
                  {showDateSep && <DateSeparator date={item.date} />}
                  {item.kind === "file" ? (
                    <FileThreadItem file={item.data} />
                  ) : (
                    <ActivityThreadItem activity={item.data} />
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
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground shrink-0">
        {format(date, "MMMM d, yyyy")}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function ActivityThreadItem({ activity }: { activity: LeadActivity }) {
  const Icon = activityIcons[activity.activity_type] || MessageSquare;
  const isNote = activity.activity_type === "note";
  const isStageChange = activity.activity_type === "stage_change";
  const author = activity.created_by || "System";

  return (
    <div className={cn(
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
            {activity.activity_type === "email" && <Mail className="w-3 h-3 text-muted-foreground shrink-0" />}
            {isStageChange && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {format(new Date(activity.created_at), "h:mm a")}
          </span>
        </div>
        {isStageChange && <p className="text-[13px] mt-0.5">{activity.title}</p>}
        {activity.description && (
          <p className="text-[13px] text-foreground/80 whitespace-pre-wrap mt-0.5 leading-relaxed">
            {activity.description}
          </p>
        )}
        {!isStageChange && !activity.description && (
          <p className="text-[13px] text-foreground/80 mt-0.5">{activity.title}</p>
        )}
      </div>
    </div>
  );
}

function FileThreadItem({ file }: { file: any }) {
  const ext = file.file_name?.split(".").pop()?.toUpperCase() || "FILE";
  const FileIcon = getFileIcon(file.mime_type || "", ext);
  const iconColor = getFileIconColor(ext);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      if (file.storage_path) {
        const signedUrl = await getSignedFileUrl(file.storage_path);
        if (signedUrl) window.open(signedUrl, "_blank");
      } else if (file.file_url) {
        window.open(file.file_url, "_blank");
      }
    } catch (err) {
      console.error("File download error:", err);
    }
  };

  return (
    <div className="flex gap-3 p-3 hover:bg-accent/50 rounded-md transition-colors">
      <Avatar className="w-8 h-8 shrink-0 text-[11px]">
        <AvatarFallback className="bg-muted text-muted-foreground text-[11px]">
          <FileIcon className={cn("w-4 h-4", iconColor)} />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold truncate">File attached</span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {format(new Date(file.created_at), "h:mm a")}
          </span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 mt-1 px-2.5 py-1.5 rounded border border-border bg-secondary/50 hover:bg-secondary transition-colors group text-left max-w-[280px]"
        >
          <FileIcon className={cn("w-4 h-4 shrink-0", iconColor)} />
          <span className="text-xs font-medium truncate flex-1">{file.file_name}</span>
          <Download className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </button>
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
