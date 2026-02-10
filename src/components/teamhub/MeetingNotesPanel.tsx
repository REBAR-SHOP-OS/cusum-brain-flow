import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain, ChevronRight, ChevronLeft, Lightbulb, CheckCircle2,
  ListTodo, HelpCircle, AlertTriangle, Loader2, Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptEntry {
  id: string;
  speaker_name: string;
  text: string;
  timestamp_ms: number;
  created_at: string;
}

interface LiveNotes {
  keyPoints: string[];
  decisions: string[];
  actionItems: { task: string; assignee: string | null; priority: string }[];
  questions: string[];
  risks: string[];
}

interface MeetingNotesPanelProps {
  meetingId: string;
  entries: TranscriptEntry[];
  interimText: string;
  isTranscribing: boolean;
}

export function MeetingNotesPanel({
  meetingId,
  entries,
  interimText,
  isTranscribing,
}: MeetingNotesPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [notes, setNotes] = useState<LiveNotes | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tab, setTab] = useState<"notes" | "transcript">("notes");
  const lastAnalyzedCountRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, interimText]);

  // Periodically analyze transcript
  const analyzeNotes = useCallback(async () => {
    if (entries.length === 0 || entries.length === lastAnalyzedCountRef.current) return;
    
    setIsAnalyzing(true);
    lastAnalyzedCountRef.current = entries.length;

    const transcript = entries
      .map((e) => `${e.speaker_name}: ${e.text}`)
      .join("\n");

    try {
      const { data, error } = await supabase.functions.invoke("meeting-live-notes", {
        body: { meetingId, transcript, previousNotes: notes },
      });
      if (!error && data?.notes) {
        setNotes(data.notes);
      }
    } catch (err) {
      console.error("Live notes analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [meetingId, entries, notes]);

  // Auto-analyze every 30s or every 5 new entries
  useEffect(() => {
    const diff = entries.length - lastAnalyzedCountRef.current;
    if (diff >= 5) {
      analyzeNotes();
      return;
    }

    const timer = setInterval(() => {
      if (entries.length > lastAnalyzedCountRef.current) {
        analyzeNotes();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [entries.length, analyzeNotes]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-1 border-l border-border bg-card/50">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mb-2"
          onClick={() => setCollapsed(false)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Brain className="w-4 h-4 text-primary mb-1" />
        <span className="text-[9px] text-muted-foreground writing-mode-vertical">AI Notes</span>
        {isAnalyzing && <Loader2 className="w-3 h-3 animate-spin text-primary mt-2" />}
      </div>
    );
  }

  return (
    <div className="w-[320px] flex flex-col border-l border-border bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">AI Notes</span>
          {isAnalyzing && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
          {isTranscribing && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 text-red-400 border-red-400/30">
              <Mic className="w-2.5 h-2.5" />
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={analyzeNotes} disabled={isAnalyzing || entries.length === 0}>
            Refresh
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(true)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className={cn("flex-1 text-[10px] font-semibold py-1.5 uppercase tracking-wider transition-colors",
            tab === "notes" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("notes")}
        >
          AI Notes
        </button>
        <button
          className={cn("flex-1 text-[10px] font-semibold py-1.5 uppercase tracking-wider transition-colors",
            tab === "transcript" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("transcript")}
        >
          Transcript ({entries.length})
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {tab === "notes" ? (
          <div className="p-3 space-y-3">
            {!notes && entries.length === 0 && (
              <div className="text-center py-8">
                <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">AI notes will appear as the meeting progresses...</p>
              </div>
            )}

            {notes?.keyPoints?.length ? (
              <NotesSection icon={<Lightbulb className="w-3.5 h-3.5 text-amber-400" />} title="Key Points" items={notes.keyPoints} />
            ) : null}

            {notes?.decisions?.length ? (
              <NotesSection icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-400" />} title="Decisions" items={notes.decisions} variant="success" />
            ) : null}

            {notes?.actionItems?.length ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action Items</span>
                </div>
                {notes.actionItems.map((item, i) => (
                  <div key={i} className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1.5">
                    <p className="text-xs text-foreground">{item.task}</p>
                    {item.assignee && (
                      <p className="text-[10px] text-blue-400 mt-0.5">→ {item.assignee}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {notes?.questions?.length ? (
              <NotesSection icon={<HelpCircle className="w-3.5 h-3.5 text-purple-400" />} title="Open Questions" items={notes.questions} />
            ) : null}

            {notes?.risks?.length ? (
              <NotesSection icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />} title="Risks" items={notes.risks} variant="destructive" />
            ) : null}
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {entries.map((entry) => (
              <div key={entry.id} className="flex gap-2 py-1">
                <span className="text-[9px] text-muted-foreground font-mono shrink-0 mt-0.5 w-8">
                  {formatTime(entry.timestamp_ms)}
                </span>
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold text-primary">{entry.speaker_name}</span>
                  <p className="text-xs text-foreground/90">{entry.text}</p>
                </div>
              </div>
            ))}
            {interimText && (
              <div className="flex gap-2 py-1 opacity-50">
                <span className="text-[9px] text-muted-foreground font-mono shrink-0 mt-0.5 w-8">...</span>
                <p className="text-xs text-foreground/60 italic">{interimText}</p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function NotesSection({
  icon,
  title,
  items,
  variant,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  variant?: "success" | "destructive";
}) {
  const borderColor = variant === "success"
    ? "border-green-500/20 bg-green-500/5"
    : variant === "destructive"
    ? "border-red-500/20 bg-red-500/5"
    : "border-border/50 bg-muted/10";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className={cn("rounded-lg border px-2.5 py-1.5", borderColor)}>
          <p className="text-xs text-foreground">{item}</p>
        </div>
      ))}
    </div>
  );
}
