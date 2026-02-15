import { useState, useRef } from "react";
import { PhoneIncoming, PhoneOutgoing, Clock, Sparkles, Loader2, Play, Pause } from "lucide-react";
import { Communication } from "@/hooks/useCommunications";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { primeMobileAudio } from "@/lib/audioPlayer";

function parseDisplayName(raw: string): { name: string; address: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) return { name: match[1] || match[2], address: match[2] };
  return { name: raw, address: raw };
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CallSummary {
  transcription: {
    transcript: string;
    utterances: Array<{ speakerId: string; text: string }>;
  };
  interaction: {
    speakerInsights: Record<string, { talkToListenRatio: number; sentiment: string; energy: string }>;
  };
  summary: {
    abstractiveShort: Array<{ value: string }>;
    abstractiveLong: Array<{ value: string }>;
    extractive: Array<{ value: string }>;
  };
  tasks: Array<{ title: string; description: string; priority: string }>;
}

interface CallDetailViewProps {
  communication: Communication;
  footer?: React.ReactNode;
}

export function CallDetailView({ communication, footer }: CallDetailViewProps) {
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const meta = communication.metadata ?? {};
  const duration = meta.duration as number | undefined;
  const result = meta.result as string | undefined;
  const recordingUri = meta.recording_uri as string | undefined;
  const hasRecording = !!meta.recording_id;

  const sender = parseDisplayName(communication.from);
  const recipient = parseDisplayName(communication.to);

  const handleSummarize = async () => {
    if (!recordingUri) return;
    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ringcentral-ai", {
        body: {
          recordingUri,
          analysisType: "full",
          fromNumber: sender.name,
          toNumber: recipient.name,
        },
      });
      if (error) throw error;
      setSummary(data as CallSummary);
      toast({ title: "Call Summarized", description: "AI analysis complete." });
    } catch (err) {
      console.error("Summarize error:", err);
      toast({
        title: "Summarization failed",
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

    // Prime audio element synchronously during user gesture (silent WAV)
    const audio = primeMobileAudio();
    audioRef.current = audio;

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${projectUrl}/functions/v1/ringcentral-recording?action=recording&uri=${encodeURIComponent(recordingUri)}`,
        { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }
      );

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Pause silent playback, swap to real source, replay
      audio.pause();
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
        description: err instanceof Error ? err.message : "Failed to load recording",
        variant: "destructive",
      });
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            {communication.direction === "inbound" ? (
              <PhoneIncoming className="w-5 h-5 text-primary" />
            ) : (
              <PhoneOutgoing className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {communication.direction === "inbound" ? "Incoming" : "Outgoing"} Call
            </h2>
            <p className="text-sm text-muted-foreground">via RingCentral</p>
          </div>
          {hasRecording && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handlePlayRecording}
                disabled={loadingAudio}
              >
                {loadingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : playing ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={handleSummarize}
                disabled={summarizing || !recordingUri}
              >
                {summarizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {summarizing ? "Analyzing..." : summary ? "Re-analyze" : "Summarize"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Call metadata grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">From</p>
            <p className="font-medium">{sender.name}</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">To</p>
            <p className="font-medium">{recipient.name}</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Time</p>
            <p className="font-medium">{formatFullDate(communication.receivedAt)}</p>
          </div>
          {duration !== undefined && (
            <div className="p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
              <p className="font-medium">
                {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
              </p>
            </div>
          )}
          {result && (
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Result</p>
              <p className={cn("font-medium capitalize", result === "Missed" && "text-destructive")}>
                {result}
              </p>
            </div>
          )}
        </div>

        {communication.subject && (
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Subject</p>
            <p>{communication.subject}</p>
          </div>
        )}

        {/* AI Summary Section */}
        {summary && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">AI Call Summary</h3>
            </div>

            {/* Quick Summary */}
            {summary.summary.abstractiveShort.length > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm">{summary.summary.abstractiveShort[0].value}</p>
              </div>
            )}

            {/* Detailed Summary */}
            {summary.summary.abstractiveLong.length > 0 && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-2">Detailed Summary</p>
                <p className="text-sm leading-relaxed">{summary.summary.abstractiveLong[0].value}</p>
              </div>
            )}

            {/* Key Highlights */}
            {summary.summary.extractive.length > 0 && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-2">Key Highlights</p>
                <ul className="space-y-1.5">
                  {summary.summary.extractive.map((h, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary shrink-0">•</span>
                      <span>{h.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Speaker Insights */}
            {Object.keys(summary.interaction.speakerInsights).length > 0 && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-2">Speaker Insights</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.interaction.speakerInsights).map(([id, insight]) => (
                    <div key={id} className="flex items-center gap-2 p-2 rounded-md bg-background">
                      <span className="text-xs font-medium">Speaker {parseInt(id) + 1}</span>
                      <Badge variant="outline" className="text-xs capitalize">{insight.sentiment}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(insight.talkToListenRatio * 100)}% talk
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript */}
            {summary.transcription.utterances.length > 0 && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-3">Transcript</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {summary.transcription.utterances.map((u, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="text-primary font-medium shrink-0 w-20">
                        Speaker {parseInt(u.speakerId) + 1}
                      </span>
                      <span className="text-foreground/90">{u.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {summary.tasks.length > 0 && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-2">Action Items</p>
                <ul className="space-y-2">
                  {summary.tasks.map((task, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs shrink-0 mt-0.5",
                          task.priority === "high" && "border-destructive text-destructive",
                          task.priority === "medium" && "border-yellow-500 text-yellow-500",
                          task.priority === "low" && "border-muted-foreground"
                        )}
                      >
                        {task.priority}
                      </Badge>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-muted-foreground text-xs">{task.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Prompt to summarize if recording available but no summary yet */}
        {hasRecording && !summary && !summarizing && (
          <div className="flex items-center justify-center p-6 rounded-lg border border-dashed border-border">
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Recording available — click <span className="font-medium text-foreground">Summarize</span> for AI analysis
              </p>
            </div>
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}