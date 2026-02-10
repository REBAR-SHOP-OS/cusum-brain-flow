import { useState, useCallback } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  FileText,
  BarChart3,
  ListChecks,
  MessageSquare,
  User,
  CheckCircle2,
  Brain,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Utterance {
  speakerId: string;
  text: string;
  start?: number;
  end?: number;
  confidence?: number;
  sentiment?: string;
}

interface SummarySection {
  value?: string;
}

interface AnalysisResult {
  transcription: {
    transcript: string;
    confidence: number;
    utterances: Utterance[];
  } | null;
  interaction: {
    speakerInsights: any;
    conversationalInsights: any;
    utterances: Utterance[];
  } | null;
  summary: {
    abstractiveShort: SummarySection[];
    abstractiveLong: SummarySection[];
    extractive: SummarySection[];
  } | null;
  tasks: Array<{ title: string; description: string; priority: string }>;
}

interface CallAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingUri: string;
  fromNumber: string;
  toNumber: string;
  callId: string;
}

const speakerColors: Record<string, string> = {
  "0": "text-blue-500",
  "1": "text-emerald-500",
  "2": "text-amber-500",
  "3": "text-purple-500",
};

function SpeakerLabel({ id }: { id: string }) {
  return (
    <span className={`text-xs font-bold ${speakerColors[id] || "text-muted-foreground"}`}>
      Speaker {parseInt(id) + 1}
    </span>
  );
}

function formatTime(seconds?: number): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallAnalysisDialog({
  open,
  onOpenChange,
  recordingUri,
  fromNumber,
  toNumber,
  callId,
}: CallAnalysisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingTasks, setSavingTasks] = useState(false);
  const [tasksSaved, setTasksSaved] = useState(false);
  const [brainSaved, setBrainSaved] = useState(false);
  const { toast } = useToast();
  const { companyId } = useCompanyId();

  const handleSaveToBrain = async () => {
    if (!result || !companyId) return;
    try {
      const summaryText = result.summary?.abstractiveShort?.map(s => s.value).join("\n") || result.transcription?.transcript || "";
      const { error } = await supabase.from("knowledge").insert({
        title: `Call Analysis: ${fromNumber} → ${toNumber}`,
        content: summaryText,
        category: "call-analysis",
        company_id: companyId,
      });
      if (error) throw error;
      setBrainSaved(true);
      toast({ title: "Saved to Brain" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
  };

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTasksSaved(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in first");

      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${projectUrl}/functions/v1/ringcentral-ai`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordingUri,
          analysisType: "full",
          fromNumber,
          toNumber,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(errData.error || `Analysis failed (${resp.status})`);
      }

      const data: AnalysisResult = await resp.json();
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
      toast({ title: "Analysis Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [recordingUri, fromNumber, toNumber, toast]);

  const handleSaveTasks = useCallback(async () => {
    if (!result?.tasks?.length) return;
    setSavingTasks(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const tasksToInsert = result.tasks.map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: "open",
        source: "ringcentral-ai",
        source_ref: callId,
        company_id: companyId!,
      }));

      const { error: insertError } = await supabase
        .from("tasks")
        .insert(tasksToInsert);

      if (insertError) throw insertError;

      setTasksSaved(true);
      toast({
        title: "Tasks Created",
        description: `${result.tasks.length} task(s) created from call analysis`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save tasks",
        variant: "destructive",
      });
    } finally {
      setSavingTasks(false);
    }
  }, [result, callId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Call Analysis
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {fromNumber} → {toNumber}
          </p>
        </DialogHeader>

        {/* Not yet analyzed */}
        {!loading && !result && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold mb-1">AI-Powered Call Analysis</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                AI will transcribe the recording with speaker identification,
                analyze sentiment & interaction patterns, generate a summary, and extract action items.
              </p>
            </div>
            <Button onClick={runAnalysis} className="gap-2">
              <Brain className="w-4 h-4" />
              Start Analysis
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="font-semibold mb-1">Analyzing Call Recording</h3>
              <p className="text-sm text-muted-foreground">
                Running speech-to-text, speaker diarization, sentiment analysis, and summarization...
                <br />
                This may take 30–60 seconds.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" onClick={runAnalysis}>
              Retry
            </Button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <Tabs defaultValue="transcript" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="transcript" className="gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5">
                <ListChecks className="w-3.5 h-3.5" />
                Tasks
                {result.tasks.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    {result.tasks.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Transcript Tab */}
            <TabsContent value="transcript" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px]">
                {result.transcription?.utterances?.length ? (
                  <div className="space-y-3 pr-4">
                    {result.transcription.utterances.map((u, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center gap-1 min-w-[70px]">
                          <SpeakerLabel id={u.speakerId} />
                          {u.start != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatTime(u.start)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{u.text}</p>
                          {u.sentiment && (
                            <Badge
                              variant="outline"
                              className="text-[10px] mt-1"
                            >
                              {u.sentiment}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : result.transcription?.transcript ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {result.transcription.transcript}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No transcription available.
                  </p>
                )}
                {result.transcription?.confidence != null && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Confidence: {Math.round(result.transcription.confidence * 100)}%
                    </span>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-6 pr-4">
                  {/* Abstractive Short */}
                  {result.summary?.abstractiveShort?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Quick Summary
                      </h4>
                      {result.summary.abstractiveShort.map((s, i) => (
                        <p key={i} className="text-sm leading-relaxed">
                          {s.value || JSON.stringify(s)}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {/* Abstractive Long */}
                  {result.summary?.abstractiveLong?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Detailed Summary
                      </h4>
                      {result.summary.abstractiveLong.map((s, i) => (
                        <p key={i} className="text-sm leading-relaxed">
                          {s.value || JSON.stringify(s)}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {/* Extractive Highlights */}
                  {result.summary?.extractive?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Key Highlights
                      </h4>
                      <ul className="space-y-2">
                        {result.summary.extractive.map((s, i) => (
                          <li
                            key={i}
                            className="text-sm leading-relaxed border-l-2 border-primary/30 pl-3"
                          >
                            {s.value || JSON.stringify(s)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.summary && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={handleSaveToBrain} disabled={brainSaved}>
                      <Brain className="w-3.5 h-3.5" />
                      {brainSaved ? "Saved to Brain" : "Save to Brain"}
                    </Button>
                  )}

                  {!result.summary && (
                    <p className="text-sm text-muted-foreground italic">
                      No summary available. The call may be too short.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-6 pr-4">
                  {result.interaction?.speakerInsights ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        Speaker Insights
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(result.interaction.speakerInsights).map(
                          ([speakerId, insights]: [string, any]) => (
                            <div
                              key={speakerId}
                              className="border border-border rounded-lg p-3"
                            >
                              <SpeakerLabel id={speakerId} />
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {insights.talkToListenRatio != null && (
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block">
                                      Talk/Listen Ratio
                                    </span>
                                    <span className="text-sm font-medium">
                                      {Math.round(insights.talkToListenRatio * 100)}%
                                    </span>
                                  </div>
                                )}
                                {insights.pace != null && (
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block">
                                      Pace (WPM)
                                    </span>
                                    <span className="text-sm font-medium">
                                      {Math.round(insights.pace)}
                                    </span>
                                  </div>
                                )}
                                {insights.energy != null && (
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block">
                                      Energy
                                    </span>
                                    <span className="text-sm font-medium capitalize">
                                      {insights.energy}
                                    </span>
                                  </div>
                                )}
                                {insights.sentiment != null && (
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block">
                                      Sentiment
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {insights.sentiment}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}

                  {result.interaction?.conversationalInsights ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        Conversation Insights
                      </h4>
                      <div className="space-y-2">
                        {Array.isArray(result.interaction.conversationalInsights) &&
                          result.interaction.conversationalInsights.map((insight: any, i: number) => (
                            <div key={i} className="border border-border rounded-lg p-3">
                              <span className="text-xs font-medium capitalize">
                                {insight.name || insight.type}
                              </span>
                              {insight.values?.map((v: any, vi: number) => (
                                <p key={vi} className="text-sm mt-1 text-muted-foreground">
                                  {v.value || JSON.stringify(v)}
                                </p>
                              ))}
                            </div>
                          ))}
                        {typeof result.interaction.conversationalInsights === "object" &&
                          !Array.isArray(result.interaction.conversationalInsights) && (
                            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                              {JSON.stringify(result.interaction.conversationalInsights, null, 2)}
                            </pre>
                          )}
                      </div>
                    </div>
                  ) : null}

                  {!result.interaction && (
                    <p className="text-sm text-muted-foreground italic">
                      No interaction insights available. Your RingCentral plan may not include AI analytics.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {result.tasks.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {result.tasks.map((task, i) => (
                          <div
                            key={i}
                            className="border border-border rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between">
                              <h5 className="text-sm font-medium">{task.title}</h5>
                              <Badge
                                variant={
                                  task.priority === "high"
                                    ? "destructive"
                                    : task.priority === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px] ml-2 shrink-0"
                              >
                                {task.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </p>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleSaveTasks}
                        disabled={savingTasks || tasksSaved}
                        className="w-full gap-2"
                      >
                        {tasksSaved ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Tasks Saved
                          </>
                        ) : savingTasks ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <ListChecks className="w-4 h-4" />
                            Create All Tasks
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No action items detected in this call.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
