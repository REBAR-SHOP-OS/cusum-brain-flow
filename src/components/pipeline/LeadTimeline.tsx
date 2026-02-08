import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Phone, Mail, Calendar, ArrowRight, Bot,
  Plus, Send, Clock, CheckCircle2, Loader2, Sparkles,
  PhoneCall, FileText, Zap, Download, Trash2, Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Tables, Json } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadActivity = Tables<"lead_activities">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadTimelineProps {
  lead: LeadWithCustomer;
}

// --- File type helpers ---

const FILE_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bgColor: string }> = {
  xls: { icon: "X", label: "XLS", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40" },
  xlsx: { icon: "X", label: "XLSX", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40" },
  csv: { icon: "X", label: "CSV", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40" },
  pdf: { icon: "P", label: "PDF", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/40" },
  dwg: { icon: "D", label: "DWG", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  dxf: { icon: "D", label: "DXF", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  doc: { icon: "W", label: "DOC", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  docx: { icon: "W", label: "DOCX", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  png: { icon: "I", label: "PNG", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
  jpg: { icon: "I", label: "JPG", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
  jpeg: { icon: "I", label: "JPEG", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
};

function getFileTypeConfig(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_TYPE_CONFIG[ext] || { icon: "F", label: ext.toUpperCase() || "FILE", color: "text-muted-foreground", bgColor: "bg-muted" };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500",
    "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function parseEmailName(raw: string): string {
  const match = raw.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : raw.split("@")[0];
}

// --- Highlight @mentions in text ---
function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[\w._-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0 font-medium mx-0.5 align-baseline">
          {part}
        </Badge>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// --- Parse quoted replies from email body ---
function splitQuotedContent(body: string): { main: string; quoted: string | null } {
  // Look for common quote patterns
  const quotePatterns = [
    /^([\s\S]*?)(?:\n>[\s]*\n|\n>{2,})/m,
    /^([\s\S]*?)(?:\nOn .+ wrote:\n)/m,
    /^([\s\S]*?)(?:\n-{3,}\s*Original Message)/mi,
    /^([\s\S]*?)(?:\n_{3,}\s*From:)/mi,
  ];

  for (const pattern of quotePatterns) {
    const match = body.match(pattern);
    if (match && match[1] && match[1].length < body.length * 0.9) {
      return { main: match[1].trim(), quoted: body.slice(match[1].length).trim() };
    }
  }

  return { main: body, quoted: null };
}

// --- Unified timeline item type ---
interface TimelineItem {
  id: string;
  type: "email" | "activity";
  date: Date;
  sender: string;
  senderType: "email" | "note" | "call" | "meeting" | "ai_suggestion" | "stage_change" | "follow_up" | string;
  content: string;
  quotedContent?: string | null;
  subject?: string;
  attachments?: Array<{ filename: string; mimeType?: string; size?: number; attachmentId?: string }>;
  isCompleted?: boolean;
}

// --- Activity config ---
const activityIcons: Record<string, React.ElementType> = {
  note: MessageSquare, call: PhoneCall, email: Mail, meeting: Calendar,
  stage_change: ArrowRight, ai_suggestion: Bot, follow_up: Clock,
  internal_task: FileText,
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

// ===================== MAIN COMPONENT =====================

export function LeadTimeline({ lead }: LeadTimelineProps) {
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch lead activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
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

  // Fetch email thread from communications
  const commId = lead.source_email_id?.replace("comm_", "") || null;

  const { data: threadEmails = [], isLoading: threadLoading } = useQuery({
    queryKey: ["lead-thread", commId],
    enabled: !!commId,
    queryFn: async () => {
      if (!commId) return [];

      // First get the thread_id from the source communication
      const { data: sourceCom } = await supabase
        .from("communications")
        .select("thread_id")
        .eq("id", commId)
        .maybeSingle();

      if (!sourceCom?.thread_id) return [];

      // Then fetch all emails in that thread
      const { data, error } = await supabase
        .from("communications")
        .select("id, from_address, to_address, subject, body_preview, metadata, received_at")
        .eq("thread_id", sourceCom.thread_id)
        .order("received_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Merge into unified timeline
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Add emails
    for (const email of threadEmails) {
      const meta = email.metadata as Record<string, unknown> | null;
      const body = (meta?.body as string) || email.body_preview || "";
      const { main, quoted } = splitQuotedContent(body);
      const attachments = (meta?.attachments as Array<{ filename: string; mimeType?: string; size?: number; attachmentId?: string }>) || [];

      items.push({
        id: `email-${email.id}`,
        type: "email",
        date: new Date(email.received_at || ""),
        sender: email.from_address || "Unknown",
        senderType: "email",
        content: main,
        quotedContent: quoted,
        subject: email.subject || undefined,
        attachments,
      });
    }

    // Add activities
    for (const activity of activities) {
      items.push({
        id: `activity-${activity.id}`,
        type: "activity",
        date: new Date(activity.created_at),
        sender: activity.created_by || "System",
        senderType: activity.activity_type,
        content: activity.description || activity.title,
        isCompleted: !!activity.completed_at,
      });
    }

    // Sort chronologically (newest first)
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [threadEmails, activities]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: { date: Date; items: TimelineItem[] }[] = [];
    let currentGroup: { date: Date; items: TimelineItem[] } | null = null;

    for (const item of timelineItems) {
      if (!currentGroup || !isSameDay(currentGroup.date, item.date)) {
        currentGroup = { date: item.date, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }

    return groups;
  }, [timelineItems]);

  // Mutations
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

  const isLoading = activitiesLoading || threadLoading;

  const urgencyColors: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/30",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    low: "bg-green-500/10 text-green-500 border-green-500/30",
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
  };

  return (
    <div className="space-y-4">
      {/* AI Assist Button */}
      <Button onClick={handleAISuggest} disabled={isAiLoading} className="w-full gap-2" variant="outline">
        {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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
                  <Button size="sm" variant="ghost" onClick={() => handleAcceptSuggestion(s)} className="shrink-0 text-xs gap-1 h-7">
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
          <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Log activity details..." rows={3} className="text-sm" />
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setIsAddingNote(false); setNewNote(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || addActivityMutation.isPending} className="gap-1.5">
              <Send className="w-3 h-3" /> Log
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAddingNote(true)} className="w-full gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Log Activity
        </Button>
      )}

      {/* Conversation Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : timelineItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activities yet. Log a note or let AI suggest next steps.
        </p>
      ) : (
        <div className="space-y-1">
          {groupedItems.map((group) => (
            <div key={group.date.toISOString()}>
              {/* Date Separator */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {format(group.date, "MMMM d, yyyy")}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Messages for this date */}
              <div className="space-y-4">
                {group.items.map((item) => (
                  <ConversationMessage key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== CONVERSATION MESSAGE =====================

function ConversationMessage({ item }: { item: TimelineItem }) {
  const senderName = item.type === "email" ? parseEmailName(item.sender) : item.sender;
  const avatarColor = getAvatarColor(senderName);
  const Icon = item.type === "activity" ? (activityIcons[item.senderType] || MessageSquare) : Mail;
  const timeAgo = formatDistanceToNow(item.date, { addSuffix: true });

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <Avatar className="w-9 h-9 shrink-0 mt-0.5">
        <AvatarFallback className={cn("text-white text-xs font-bold", avatarColor)}>
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header: Name + icon + time */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{senderName}</span>
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">- {timeAgo}</span>
          {item.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        </div>

        {/* Content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {renderTextWithMentions(item.content)}
        </div>

        {/* Quoted Reply */}
        {item.quotedContent && (
          <div className="border-l-2 border-muted-foreground/30 pl-3 py-2 rounded-r-md bg-muted/30">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
              {renderTextWithMentions(item.quotedContent)}
            </p>
          </div>
        )}

        {/* Attachments */}
        {item.attachments && item.attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {item.attachments.map((file, i) => (
              <FileAttachmentCard key={i} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== FILE ATTACHMENT CARD =====================

function FileAttachmentCard({ file }: { file: { filename: string; mimeType?: string; size?: number } }) {
  const config = getFileTypeConfig(file.filename);

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group">
      {/* File Type Icon */}
      <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0 font-bold text-sm", config.bgColor, config.color)}>
        {config.icon}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.filename}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{config.label}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Download className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
