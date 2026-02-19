import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Phone, Mail, Calendar, ArrowRight, Bot,
  Plus, Send, Clock, CheckCircle2, Loader2, Sparkles,
  PhoneCall, FileText, Zap, Download, File, FileSpreadsheet, Image,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadActivity = Tables<"lead_activities">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadTimelineProps {
  lead: LeadWithCustomer;
}

const activityIcons: Record<string, React.ElementType> = {
  note: MessageSquare,
  call: PhoneCall,
  email: Mail,
  meeting: Calendar,
  stage_change: ArrowRight,
  ai_suggestion: Bot,
  follow_up: Clock,
  internal_task: FileText,
  comment: MessageSquare,
  system: Zap,
};

const activityColors: Record<string, string> = {
  note: "bg-blue-500/10 text-blue-500",
  call: "bg-green-500/10 text-green-500",
  email: "bg-purple-500/10 text-purple-500",
  meeting: "bg-amber-500/10 text-amber-500",
  stage_change: "bg-cyan-500/10 text-cyan-500",
  ai_suggestion: "bg-primary/10 text-primary",
  follow_up: "bg-orange-500/10 text-orange-500",
  internal_task: "bg-muted text-muted-foreground",
  comment: "bg-blue-500/10 text-blue-500",
  system: "bg-muted text-muted-foreground",
};

interface AISuggestion {
  action_type: string;
  title: string;
  description: string;
  priority: string;
  timing: string;
}

interface AIAnalysis {
  summary: string;
  urgency: string;
  suggestions: AISuggestion[];
}

export function LeadTimeline({ lead }: LeadTimelineProps) {
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Fetch lead_events (Odoo sync timeline parity)
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

  // Convert lead_events into activity-like items for the timeline
  const eventActivities = leadEvents.map((evt: any) => {
    const payload = evt.payload as Record<string, unknown> || {};
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
      description = `${payload.customer_name || ""}`;
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
      completed_at: null,
      company_id: lead.company_id,
    };
  });

  // Merge activities, files, and lead_events into a unified timeline
  type TimelineItem = { type: "activity"; data: LeadActivity; date: Date } | { type: "file"; data: typeof files[0]; date: Date };
  const timeline: TimelineItem[] = [
    ...activities.map((a) => ({ type: "activity" as const, data: a, date: new Date(a.created_at) })),
    ...eventActivities.map((a: any) => ({ type: "activity" as const, data: a as LeadActivity, date: new Date(a.created_at) })),
    ...files.map((f) => ({ type: "file" as const, data: f, date: new Date(f.created_at) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const addActivityMutation = useMutation({
    mutationFn: async (activity: { activity_type: string; title: string; description?: string }) => {
      const { error } = await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        company_id: lead.company_id,
        activity_type: activity.activity_type,
        title: activity.title,
        description: activity.description || null,
        created_by: "You",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      setNewNote("");
      setIsAddingNote(false);
      toast({ title: "Activity logged" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addActivityMutation.mutate({
      activity_type: noteType,
      title: noteType === "note" ? "Note added" : `${noteType.charAt(0).toUpperCase() + noteType.slice(1)} logged`,
      description: newNote,
    });
  };

  const handleAISuggest = async () => {
    setIsAiLoading(true);
    setAiAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: {
          action: "suggest_actions",
          lead: {
            ...lead,
            customer_name: lead.customers?.company_name || lead.customers?.name,
          },
          activities: activities.slice(0, 10),
        },
      });
      if (error) throw error;
      setAiAnalysis(data as AIAnalysis);
    } catch (err) {
      console.error("AI suggestion error:", err);
      toast({
        title: "AI analysis failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAcceptSuggestion = (suggestion: AISuggestion) => {
    addActivityMutation.mutate({
      activity_type: suggestion.action_type,
      title: suggestion.title,
      description: `${suggestion.description}\n\n⏰ Timing: ${suggestion.timing} | Priority: ${suggestion.priority}`,
    });
  };

  const urgencyColors: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/30",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    low: "bg-green-500/10 text-green-500 border-green-500/30",
  };

  return (
    <div className="space-y-4">
      {/* AI Assist Button */}
      <Button
        onClick={handleAISuggest}
        disabled={isAiLoading}
        className="w-full gap-2"
        variant="outline"
      >
        {isAiLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {isAiLoading ? "Analyzing lead..." : "AI: Suggest Next Actions"}
      </Button>

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Blitz AI Analysis</span>
            <Badge variant="outline" className={cn("text-xs ml-auto", urgencyColors[aiAnalysis.urgency])}>
              {aiAnalysis.urgency}
            </Badge>
          </div>
          <p className="text-sm">{aiAnalysis.summary}</p>

          <div className="space-y-2">
            {aiAnalysis.suggestions.map((s, i) => {
              const Icon = activityIcons[s.action_type] || Zap;
              return (
                <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-background/80 border border-border">
                  <div className={cn("p-1.5 rounded-md shrink-0", activityColors[s.action_type] || "bg-muted")}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{s.timing}</Badge>
                      <Badge variant="secondary" className="text-xs">{s.priority}</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAcceptSuggestion(s)}
                    className="shrink-0 text-xs gap-1 h-7"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Activity Form */}
      {isAddingNote ? (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">📝 Note</SelectItem>
                <SelectItem value="call">📞 Call</SelectItem>
                <SelectItem value="email">✉️ Email</SelectItem>
                <SelectItem value="meeting">📅 Meeting</SelectItem>
                <SelectItem value="follow_up">⏰ Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SmartTextarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Log activity details..."
            rows={3}
            className="text-sm"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setIsAddingNote(false); setNewNote(""); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || addActivityMutation.isPending} className="gap-1.5">
              <Send className="w-3 h-3" />
              Log
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAddingNote(true)} className="w-full gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Log Activity
        </Button>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-[13px] text-muted-foreground">
            No activities yet.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Log a note or let AI suggest next steps.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {timeline.map((item, idx) => {
            const itemDate = item.date;

            // Date separator
            const prevDate = idx > 0 ? timeline[idx - 1].date : null;
            const showDateSep = !prevDate || format(itemDate, "yyyy-MM-dd") !== format(prevDate, "yyyy-MM-dd");

            if (item.type === "file") {
              const f = item.data;
              const ext = f.file_name?.split(".").pop()?.toUpperCase() || "FILE";
              const FileIcon = getFileIcon(f.mime_type || "", ext);
              const iconColor = getFileIconColor(ext);

              const hasStoragePath = f.storage_path;
              const isOdooFile = !hasStoragePath && f.file_url?.includes("/web/content/") && f.odoo_id;

              const handleDownload = async (e: React.MouseEvent) => {
                e.preventDefault();
                try {
                  if (hasStoragePath) {
                    const signedUrl = await getSignedFileUrl(f.storage_path!);
                    if (!signedUrl) return;
                    window.open(signedUrl, "_blank");
                  } else if (isOdooFile) {
                    // Legacy: still on Odoo proxy (not yet migrated)
                    const { data: sessionData } = await supabase.auth.getSession();
                    const token = sessionData.session?.access_token;
                    if (!token) return;
                    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/odoo-file-proxy?id=${f.odoo_id}`;
                    const res = await fetch(proxyUrl, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error("Download failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = f.file_name || `file-${f.odoo_id}`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } else if (f.file_url) {
                    window.open(f.file_url, "_blank");
                  }
                } catch (err) {
                  console.error("File download error:", err);
                }
              };

              const isImage = f.mime_type?.startsWith("image/") && !f.mime_type?.includes("dwg");

              return (
                <div key={`file-${f.id}`}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs font-medium text-primary shrink-0">
                        {format(itemDate, "MMMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-3 py-1 pl-11">
                    <div className="space-y-1.5 max-w-[320px]">
                      {isOdooFile && !hasStoragePath && (
                        <OdooImagePreview odooId={f.odoo_id!} fileName={f.file_name || "image"} />
                      )}
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary/50 hover:bg-secondary transition-colors group w-full text-left"
                      >
                        <FileIcon className={cn("w-5 h-5 shrink-0", iconColor)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{f.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">{ext}</p>
                        </div>
                        <Download className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Activity entry
            const activity = item.data;
            const Icon = activityIcons[activity.activity_type] || MessageSquare;
            const colorClass = activityColors[activity.activity_type] || "bg-muted text-muted-foreground";

            return (
              <div key={activity.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-medium text-primary shrink-0">
                      {format(itemDate, "MMMM d, yyyy")}
                    </span>
                  </div>
                )}

                <div className="flex gap-3 py-2">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{activity.created_by || "System"}</span>
                      {activity.activity_type === "email" && <Mail className="w-3 h-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">
                        – {format(itemDate, "h:mm a")} · {formatDistanceToNow(itemDate, { addSuffix: true })}
                      </span>
                      {activity.completed_at && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      )}
                    </div>
                    {activity.activity_type === "stage_change" && (
                      <p className="text-sm mt-1">{activity.title}</p>
                    )}
                    {activity.description && (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-1 leading-relaxed">
                        {activity.description}
                      </p>
                    )}
                    {activity.activity_type !== "stage_change" && !activity.description && (
                      <p className="text-sm text-foreground/80 mt-0.5">{activity.title}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline image preview for Odoo attachments
function OdooImagePreview({ odooId, fileName }: { odooId: string | number; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/odoo-file-proxy?id=${odooId}`;
        const res = await fetch(proxyUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        if (!cancelled) setSrc(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [odooId]);

  if (error || !src) {
    if (error) return null; // silently skip broken images
    return <div className="w-full h-24 rounded-md bg-muted animate-pulse" />;
  }

  return (
    <img
      src={src}
      alt={fileName}
      className="rounded-md border border-border max-h-48 w-auto object-contain bg-muted"
      loading="lazy"
    />
  );
}

// File icon helpers
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
