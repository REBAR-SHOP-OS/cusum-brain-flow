import { useState } from "react";
import { Play, Pause, Sparkles, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Communication } from "@/hooks/useCommunications";

interface VoicemailPlayerProps {
  communication: Communication;
}

export function VoicemailPlayer({ communication }: VoicemailPlayerProps) {
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const { toast } = useToast();
  const meta = communication.metadata as Record<string, unknown> | null;

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const recordingUri = meta?.recording_uri as string;
      const recordingId = meta?.recording_id as string;

      if (!recordingUri && !recordingId) {
        toast({ title: "No recording available", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("ringcentral-ai", {
        body: {
          action: "transcribe",
          recording_id: recordingId,
          recording_uri: recordingUri,
          source_id: communication.sourceId,
        },
      });

      if (error) throw error;
      setTranscript(data?.transcript || data?.summary || "No transcript available");
      toast({ title: "Transcription complete" });
    } catch (err) {
      console.error("Transcription error:", err);
      toast({
        title: "Transcription failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Voicemail</p>
          <p className="text-xs text-muted-foreground">
            {meta?.duration ? `${Math.floor((meta.duration as number) / 60)}m ${(meta.duration as number) % 60}s` : "Unknown duration"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTranscribe}
          disabled={transcribing}
          className="gap-2"
        >
          {transcribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {transcribing ? "Transcribing..." : "AI Transcribe"}
        </Button>
      </div>

      {transcript && (
        <div className="p-4 rounded-lg border border-border bg-background">
          <p className="text-xs font-medium text-muted-foreground mb-2">AI Transcript</p>
          <p className="text-sm whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
    </div>
  );
}
