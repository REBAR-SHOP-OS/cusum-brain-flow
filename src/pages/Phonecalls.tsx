import { useState, useCallback, useRef } from "react";
import { Phone, RefreshCw, Search, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Pause, Clock, PhoneCall, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCommunications } from "@/hooks/useCommunications";
import { useRingCentralWidget } from "@/hooks/useRingCentralWidget";
import { LiveCallPanel } from "@/components/phonecalls/LiveCallPanel";
import { CallSummaryDialog } from "@/components/phonecalls/CallSummaryDialog";
import { CallAnalysisDialog } from "@/components/phonecalls/CallAnalysisDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type CallFilter = "all" | "missed";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function DirectionIcon({ direction, result }: { direction: string; result?: string }) {
  if (result === "Missed") {
    return <PhoneMissed className="w-4 h-4 text-destructive" />;
  }
  if (direction === "inbound") {
    return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
  }
  return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
}

function ResultBadge({ result }: { result?: string }) {
  if (!result) return null;
  const variant = result === "Missed" ? "destructive" : result === "Accepted" ? "default" : "secondary";
  return <Badge variant={variant} className="text-xs">{result}</Badge>;
}

export default function Phonecalls() {
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<CallFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState<string | null>(null);
  const [analysisCall, setAnalysisCall] = useState<{
    id: string;
    recordingUri: string;
    from: string;
    to: string;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { communications: allCalls, loading, error, refresh } = useCommunications({
    search: searchQuery || undefined,
    typeFilter: "call",
  });

  const { isLoaded, isCallActive, activeCall, showWidget } = useRingCentralWidget();

  const calls = filter === "missed"
    ? allCalls.filter((c) => (c.metadata?.result as string) === "Missed")
    : allCalls;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(search);
  };

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Error", description: "Please log in first", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke("ringcentral-sync", {
        body: { syncType: "calls", daysBack: 30 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;

      const result = response.data as { callsUpserted?: number };
      toast({
        title: "Sync Complete",
        description: `${result.callsUpserted ?? 0} calls synced from RingCentral`,
      });
      refresh();
    } catch (err) {
      toast({
        title: "Sync Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [refresh, toast]);

  const handleCallEnd = useCallback((transcript: string) => {
    if (transcript.trim()) {
      setLastTranscript(transcript);
      setShowSummary(true);
    }
    setTimeout(() => refresh(), 5000);
  }, [refresh]);

  const handlePlayRecording = useCallback(async (callId: string, recordingUri: string) => {
    // If already playing this recording, pause it
    if (playingId === callId && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setLoadingRecording(callId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Error", description: "Please log in first", variant: "destructive" });
        return;
      }

      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const audioUrl = `${projectUrl}/functions/v1/ringcentral-recording?action=recording&uri=${encodeURIComponent(recordingUri)}`;

      const audio = new Audio();
      audio.crossOrigin = "anonymous";

      // Fetch the audio as a blob with auth headers
      const resp = await fetch(audioUrl, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Failed to fetch recording" }));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      audio.src = blobUrl;

      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(blobUrl);
      };

      audio.onerror = () => {
        setPlayingId(null);
        URL.revokeObjectURL(blobUrl);
        toast({ title: "Playback Error", description: "Could not play the recording", variant: "destructive" });
      };

      await audio.play();
      audioRef.current = audio;
      setPlayingId(callId);
    } catch (err) {
      toast({
        title: "Recording Error",
        description: err instanceof Error ? err.message : "Failed to load recording",
        variant: "destructive",
      });
    } finally {
      setLoadingRecording(null);
    }
  }, [playingId, toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Phonecalls</h1>
              <p className="text-sm text-muted-foreground">RingCentral call log & live transcription</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoaded && (
              <Button variant="default" size="sm" onClick={showWidget} className="gap-2">
                <PhoneCall className="w-4 h-4" />
                Open Dialer
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
              Sync RingCentral
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as CallFilter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="missed">
                <PhoneMissed className="w-3.5 h-3.5 mr-1.5" />
                Missed
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-secondary border-0"
            />
          </form>
        </div>
      </header>

      {/* Active Call Panel */}
      {(isCallActive || lastTranscript) && (
        <div className="p-4 border-b border-border">
          <LiveCallPanel
            fromNumber={activeCall?.fromNumber}
            toNumber={activeCall?.toNumber}
            direction={activeCall?.direction}
            startTime={activeCall?.startTime}
            onCallEnd={handleCallEnd}
            isActive={isCallActive}
          />
        </div>
      )}

      {/* Call Log Table */}
      <div className="flex-1 overflow-auto">
        {loading && calls.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading calls...
          </div>
        ) : error && calls.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Phone className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">No calls found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {filter === "missed"
                ? "No missed calls."
                : "Click Sync RingCentral to fetch your call history, or use the Dialer to make a call."}
            </p>
            <div className="flex gap-2">
              {isLoaded && (
                <Button variant="default" size="sm" onClick={showWidget} className="gap-2">
                  <PhoneCall className="w-4 h-4" />
                  Open Dialer
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                Sync Now
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="w-12">Recording</TableHead>
                <TableHead className="w-12">AI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const meta = call.metadata ?? {};
                const duration = meta.duration as number | undefined;
                const result = meta.result as string | undefined;
                const action = meta.action as string | undefined;
                const hasRecording = !!meta.recording_id;
                const recordingUri = meta.recording_uri as string | undefined;
                const isPlaying = playingId === call.id;
                const isLoadingThis = loadingRecording === call.id;

                return (
                  <TableRow
                    key={call.id}
                    className={cn(result === "Missed" && "bg-destructive/5")}
                  >
                    <TableCell>
                      <DirectionIcon direction={call.direction} result={result} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(call.receivedAt)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {call.from || "Unknown"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.to || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{call.direction}</span>
                    </TableCell>
                    <TableCell>
                      <ResultBadge result={result} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(duration)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {action || "—"}
                    </TableCell>
                    <TableCell>
                      {hasRecording && recordingUri ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={isPlaying ? "Pause recording" : "Play recording"}
                          onClick={() => handlePlayRecording(call.id, recordingUri)}
                          disabled={isLoadingThis}
                        >
                          {isLoadingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : isPlaying ? (
                            <Pause className="w-4 h-4 text-primary" />
                          ) : (
                            <Play className="w-4 h-4 text-primary" />
                          )}
                        </Button>
                      ) : hasRecording ? (
                        <Play className="w-4 h-4 text-muted-foreground/40" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {hasRecording && recordingUri ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="AI Analysis"
                          onClick={() =>
                            setAnalysisCall({
                              id: call.id,
                              recordingUri,
                              from: call.from,
                              to: call.to,
                            })
                          }
                        >
                          <Brain className="w-4 h-4 text-primary" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Call Summary Dialog (live calls) */}
      <CallSummaryDialog
        open={showSummary}
        onOpenChange={setShowSummary}
        transcript={lastTranscript}
        fromNumber={activeCall?.fromNumber}
        toNumber={activeCall?.toNumber}
      />

      {/* AI Analysis Dialog (recorded calls) */}
      {analysisCall && (
        <CallAnalysisDialog
          open={!!analysisCall}
          onOpenChange={(open) => !open && setAnalysisCall(null)}
          recordingUri={analysisCall.recordingUri}
          fromNumber={analysisCall.from}
          toNumber={analysisCall.to}
          callId={analysisCall.id}
        />
      )}
    </div>
  );
}
