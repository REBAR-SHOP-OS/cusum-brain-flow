import { useState, useCallback } from "react";
import { MentionMenu } from "@/components/chat/MentionMenu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, CheckCircle2, ArrowRight, Target, FileText, Zap, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<string, React.ElementType> = {
  task_created: PlusCircle,
  task_completed: CheckCircle2,
  status_changed: ArrowRight,
  note: MessageSquare,
  file_attached: FileText,
  milestone_reached: Target,
};

const EVENT_COLORS: Record<string, string> = {
  task_created: "text-blue-500",
  task_completed: "text-emerald-500",
  status_changed: "text-amber-500",
  note: "text-primary",
  file_attached: "text-cyan-500",
  milestone_reached: "text-purple-500",
};

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface ProjectTimelineProps {
  projectId?: string;
}

export function ProjectTimeline({ projectId }: ProjectTimelineProps) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const handleNoteChange = (val: string) => {
    setNoteText(val);
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) { setMentionOpen(true); setMentionFilter(atMatch[1]); setMentionIndex(0); }
    else { setMentionOpen(false); }
  };

  const handleMentionSelect = useCallback((item: { label: string }) => {
    setNoteText(prev => prev.replace(/@\w*$/, `@${item.label} `));
    setMentionOpen(false);
  }, []);

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); }
    else if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); }
  };

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["project_events", companyId, projectId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("project_events")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!companyId) throw new Error("No company");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .single();
      const { error } = await supabase.from("project_events").insert({
        company_id: companyId,
        project_id: projectId || null,
        event_type: "note",
        title: "Note added",
        description: text,
        created_by: profile?.full_name || "You",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_events"] });
      setNoteText("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group events by date
  const grouped: Record<string, typeof events> = {};
  events.forEach(evt => {
    const key = format(new Date(evt.created_at), "yyyy-MM-dd");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(evt);
  });

  return (
    <div className="space-y-4">
      {/* Note composer */}
      <div className="flex gap-2 items-start bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
        <div className="relative flex-1">
          <Textarea
            value={noteText}
            onChange={e => handleNoteChange(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Log a note to the project timeline..."
            className="min-h-[50px] text-sm resize-none bg-transparent border-amber-300/50 dark:border-amber-700/50"
            rows={2}
          />
          <MentionMenu
            isOpen={mentionOpen}
            filter={mentionFilter}
            selectedIndex={mentionIndex}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1 h-8"
          disabled={!noteText.trim() || addNote.isPending}
          onClick={() => addNote.mutate(noteText.trim())}
        >
          {addNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Log
        </Button>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No timeline events yet. Task changes will appear automatically.
        </p>
      ) : (
        <div className="space-y-0">
          {Object.entries(grouped).map(([dateKey, dayEvents]) => (
            <div key={dateKey}>
              {/* Date separator */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                  {format(new Date(dateKey), "MMMM d, yyyy")}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {dayEvents.map(evt => {
                const Icon = EVENT_ICONS[evt.event_type] || Zap;
                const iconColor = EVENT_COLORS[evt.event_type] || "text-muted-foreground";
                const isNote = evt.event_type === "note";

                return (
                  <div
                    key={evt.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-md transition-colors hover:bg-accent/50",
                      isNote && "bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-amber-400 dark:border-amber-600"
                    )}
                  >
                    <Avatar className="w-8 h-8 shrink-0 text-[11px]">
                      <AvatarFallback className="bg-primary/10 text-primary text-[11px]">
                        {getInitials(evt.created_by)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
                          <span className="text-[13px] font-semibold truncate">{evt.created_by}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                          {format(new Date(evt.created_at), "h:mm a")}
                        </span>
                      </div>
                      <p className="text-[13px] text-foreground/80 mt-0.5">{evt.title}</p>
                      {evt.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{evt.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
