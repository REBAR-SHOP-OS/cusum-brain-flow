import { useState, useRef } from "react";
import {
  Sparkles,
  Loader2,
  Play,
  Pause,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CallSummaryResult {
  transcription: {
    transcript: string;
    utterances: Array<{ speakerId: string; text: string }>;
  };
  interaction: {
    speakerInsights: Record<
      string,
      { talkToListenRatio: number; sentiment: string; energy: string }
    >;
  };
  summary: {
    abstractiveShort: Array<{ value: string }>;
    abstractiveLong: Array<{ value: string }>;
    extractive: Array<{ value: string }>;
  };
  tasks: Array<{ title: string; description: string; priority: string }>;
}

interface InlineCallSummaryProps {
  direction: "inbound" | "outbound";
  fromName: string;
  toName: string;
  duration?: number;
  result?: string;
  recordingUri?: string;
  hasRecording: boolean;
  date: string;
}

const SPEAKER_COLORS: Record<string, string> = {
  "0": "text-blue-500",
  "1": "text-emerald-500",
  "2": "text-amber-500",
  "3": "text-purple-500",
};

export function InlineCallSummary({
  direction,
  fromName,
  toName,
  duration,
  result,
  recordingUri,
  hasRecording,
  date,
}: InlineCallSummaryProps) {
  const [summary, setSummary] = useState<CallSummaryResult | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!recordingUri) return;
    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ringcentral-ai", {
        body: {
          recordingUri,
          analysisType: "full",
          fromNumber: fromName,
          toNumber: toName,
        },
      });
      if (error) throw error;
      setSummary(data as CallSummaryResult);
      setExpanded(true);
      toast({ title: "Call Analyzed", description: "AI analysis complete." });
    } catch (err) {
      console.error("Summarize error:", err);
      toast({
        title: "Analysis failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  const handlePlayRecording = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    if (!recordingUri) return;
    setLoadingAudio(true);

    // Create Audio element synchronously during user gesture (before any await)
    const audio = new Audio();
    audioRef.current = audio;

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(
        `${projectUrl}/functions/v1/ringcentral-recording?action=recording&uri=${encodeURIComponent(recordingUri)}`,
        {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      audio.src = blobUrl;
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(blobUrl);
      };
      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(blobUrl);
        toast({ title: "Playback Error", variant: "destructive" });
      };
      await audio.play();
      setPlaying(true);
    } catch (err) {
      toast({
        title: "Recording Error",
        description:
          err instanceof Error ? err.message : "Failed to load recording",
        variant: "destructive",
      });
    } finally {
      setLoadingAudio(false);
    }
  };

  const durationStr = duration
    ? duration >= 60
      ? `${Math.floor(duration / 60)}m ${duration % 60}s`
      : `${duration}s`
    : null;

  return (
    <div className="space-y-2">
      {/* Call info bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {direction === "inbound" ? (
            <PhoneIncoming className="w-3 h-3" />
          ) : (
            <PhoneOutgoing className="w-3 h-3" />
          )}
          <span>{direction === "inbound" ? "Incoming" : "Outgoing"} call</span>
        </div>
        {durationStr && (
          <Badge variant="outline" className="text-[10px] gap-1 h-5">
            <Clock className="w-2.5 h-2.5" />
            {durationStr}
          </Badge>
        )}
        {result && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-5 capitalize",
              result === "Missed" && "border-destructive text-destructive"
            )}
          >
            {result}
          </Badge>
        )}

        {/* Action buttons */}
        {hasRecording && (
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={handlePlayRecording}
              disabled={loadingAudio}
            >
              {loadingAudio ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : playing ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={handleSummarize}
              disabled={summarizing}
            >
              {summarizing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Brain className="w-3 h-3" />
              )}
              {summarizing
                ? "Analyzing..."
                : summary
                  ? "Re-analyze"
                  : "AI Summary"}
            </Button>
          </div>
        )}
      </div>

      {/* Summary results */}
      {summary && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold">AI Call Analysis</span>
              {summary.tasks.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                  {summary.tasks.length} task{summary.tasks.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>

          {expanded && (
            <div className="px-3 pb-3 space-y-3 border-t border-primary/10">
              {/* Quick Summary */}
              {summary.summary.abstractiveShort.length > 0 && (
                <div className="pt-2">
                  <p className="text-sm leading-relaxed">
                    {summary.summary.abstractiveShort[0].value}
                  </p>
                </div>
              )}

              {/* Detailed Summary */}
              {summary.summary.abstractiveLong.length > 0 && (
                <div className="p-2.5 rounded-md bg-background/60">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Detailed Summary
                  </p>
                  <p className="text-xs leading-relaxed">
                    {summary.summary.abstractiveLong[0].value}
                  </p>
                </div>
              )}

              {/* Key Highlights */}
              {summary.summary.extractive.length > 0 && (
                <div className="p-2.5 rounded-md bg-background/60">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Key Highlights
                  </p>
                  <ul className="space-y-1">
                    {summary.summary.extractive.map((h, i) => (
                      <li key={i} className="text-xs flex gap-1.5">
                        <span className="text-primary shrink-0">•</span>
                        <span>{h.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Speaker Insights */}
              {Object.keys(summary.interaction.speakerInsights).length > 0 && (
                <div className="p-2.5 rounded-md bg-background/60">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                    <User className="w-3 h-3 inline mr-1" />
                    Speaker Insights
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(summary.interaction.speakerInsights).map(
                      ([id, insight]) => (
                        <div
                          key={id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 text-xs"
                        >
                          <span
                            className={cn(
                              "font-medium",
                              SPEAKER_COLORS[id] || "text-muted-foreground"
                            )}
                          >
                            Speaker {parseInt(id) + 1}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] capitalize h-4"
                          >
                            {insight.sentiment}
                          </Badge>
                          <span className="text-muted-foreground">
                            {Math.round(insight.talkToListenRatio * 100)}%
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {summary.transcription.utterances.length > 0 && (
                <div className="p-2.5 rounded-md bg-background/60">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                    Transcript
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {summary.transcription.utterances.map((u, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span
                          className={cn(
                            "font-medium shrink-0 w-16",
                            SPEAKER_COLORS[u.speakerId] ||
                              "text-muted-foreground"
                          )}
                        >
                          Speaker {parseInt(u.speakerId) + 1}
                        </span>
                        <span className="text-foreground/90">{u.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks / Action Items */}
              {summary.tasks.length > 0 && (
                <div className="p-2.5 rounded-md bg-background/60">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                    <ListChecks className="w-3 h-3 inline mr-1" />
                    Action Items
                  </p>
                  <ul className="space-y-1.5">
                    {summary.tasks.map((task, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] shrink-0 mt-0.5 h-4",
                            task.priority === "high" &&
                              "border-destructive text-destructive",
                            task.priority === "medium" &&
                              "border-yellow-500 text-yellow-500",
                            task.priority === "low" &&
                              "border-muted-foreground"
                          )}
                        >
                          {task.priority}
                        </Badge>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-muted-foreground">
                            {task.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prompt if recording available but no summary */}
      {hasRecording && !summary && !summarizing && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground">
          <Brain className="w-3.5 h-3.5 opacity-50" />
          Recording available — click{" "}
          <span className="font-medium text-foreground">AI Summary</span> for
          full analysis
        </div>
      )}
    </div>
  );
}
