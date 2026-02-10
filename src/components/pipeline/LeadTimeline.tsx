import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Phone, Mail, Calendar, ArrowRight, Bot,
  Plus, Send, Clock, CheckCircle2, Loader2, Sparkles,
  PhoneCall, FileText, Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
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
          <Textarea
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

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activities yet. Log a note or let AI suggest next steps.
        </p>
      ) : (
        <div className="space-y-1">
          {activities.map((activity, idx) => {
            const Icon = activityIcons[activity.activity_type] || MessageSquare;
            const colorClass = activityColors[activity.activity_type] || "bg-muted text-muted-foreground";
            const activityDate = new Date(activity.created_at);

            // Date separator: show when date differs from previous activity
            const prevDate = idx > 0 ? new Date(activities[idx - 1].created_at) : null;
            const showDateSep = !prevDate || format(activityDate, "yyyy-MM-dd") !== format(prevDate, "yyyy-MM-dd");

            return (
              <div key={activity.id}>
                {/* Date separator */}
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-medium text-primary shrink-0">
                      {format(activityDate, "MMMM d, yyyy")}
                    </span>
                  </div>
                )}

                {/* Activity entry — Odoo chatter style */}
                <div className="flex gap-3 py-2">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{activity.created_by || "System"}</span>
                      {activity.activity_type === "email" && <Mail className="w-3 h-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">
                        – {formatDistanceToNow(activityDate, { addSuffix: true })}
                      </span>
                      {activity.completed_at && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      )}
                    </div>
                    {/* Title as prefix for system/stage entries */}
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
