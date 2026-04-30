import { useMemo, useState } from "react";
import { Mic, ShieldCheck, Activity, AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  VoiceActionIntent,
  VoiceActionResponse,
  confirmVoiceAction,
  executeVoiceIntent,
  parseVoiceIntent,
  rejectVoiceAction,
} from "@/lib/voiceAgent";

type UiStep = "idle" | "parsing" | "review" | "executing" | "done" | "error";

const SAMPLE_COMMANDS = [
  "Find today’s pending deliveries",
  "Draft an email to the customer about their quote",
  "Show open production issues",
  "Add an internal note to this order",
];

function riskBadgeVariant(risk?: string) {
  if (risk === "high") return "destructive" as const;
  if (risk === "medium") return "secondary" as const;
  return "outline" as const;
}

export default function VoiceAgent() {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState("");
  const [step, setStep] = useState<UiStep>("idle");
  const [response, setResponse] = useState<VoiceActionResponse | null>(null);
  const [history, setHistory] = useState<VoiceActionResponse[]>([]);

  const intent: VoiceActionIntent | undefined = response?.intent;
  const canSubmit = transcript.trim().length > 2 && step !== "parsing" && step !== "executing";

  const statusLabel = useMemo(() => {
    switch (step) {
      case "parsing": return "Interpreting request";
      case "review": return "Waiting for review";
      case "executing": return "Executing safely";
      case "done": return "Completed";
      case "error": return "Needs attention";
      default: return "Ready";
    }
  }, [step]);

  async function handleParse() {
    if (!canSubmit) return;
    setStep("parsing");
    setResponse(null);

    try {
      const parsed = await parseVoiceIntent(transcript.trim());
      setResponse(parsed);
      setHistory((items) => [parsed, ...items].slice(0, 8));

      if (parsed.status === "pending_confirmation" || parsed.intent?.requiresConfirmation) {
        setStep("review");
      } else if (parsed.status === "permission_denied" || parsed.status === "failed") {
        setStep("error");
      } else {
        setStep("review");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice request failed";
      setStep("error");
      toast({ title: "Voice agent failed", description: message, variant: "destructive" });
    }
  }

  async function handleExecute() {
    if (!intent) return;
    setStep("executing");
    try {
      const executed = await executeVoiceIntent(intent, response?.requestId);
      setResponse(executed);
      setHistory((items) => [executed, ...items].slice(0, 8));
      setStep(executed.status === "completed" ? "done" : "error");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      setStep("error");
      toast({ title: "Execution failed", description: message, variant: "destructive" });
    }
  }

  async function handleConfirm() {
    if (!response?.requestId) return;
    setStep("executing");
    try {
      const confirmed = await confirmVoiceAction(response.requestId);
      setResponse(confirmed);
      setHistory((items) => [confirmed, ...items].slice(0, 8));
      setStep(confirmed.status === "completed" ? "done" : "error");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Confirmation failed";
      setStep("error");
      toast({ title: "Confirmation failed", description: message, variant: "destructive" });
    }
  }

  async function handleReject() {
    if (!response?.requestId) return;
    try {
      const rejected = await rejectVoiceAction(response.requestId);
      setResponse(rejected);
      setHistory((items) => [rejected, ...items].slice(0, 8));
      setStep("done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reject failed";
      toast({ title: "Reject failed", description: message, variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Permission-aware</Badge>
              <Badge variant="secondary" className="gap-1"><Activity className="h-3.5 w-3.5" /> Audited</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">AI Voice Agent</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Speak or type a business request. The agent parses intent, checks permissions, requires confirmation for risky actions, and routes execution through trusted backend controls.
            </p>
          </div>
          <Card className="border-primary/20 bg-primary/5 md:w-72">
            <CardContent className="flex items-center gap-3 p-4">
              {step === "parsing" || step === "executing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground">{statusLabel}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Command center</CardTitle>
              <CardDescription>V1 supports safe parsing, permission review, confirmation workflow, and audited execution stubs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Example: Draft an email to ABC Construction about their pending quote and prepare it for review."
                className="min-h-36 resize-none text-base"
              />

              <div className="flex flex-wrap gap-2">
                {SAMPLE_COMMANDS.map((command) => (
                  <Button key={command} type="button" variant="outline" size="sm" onClick={() => setTranscript(command)}>
                    {command}
                  </Button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleParse} disabled={!canSubmit} className="gap-2">
                  {step === "parsing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Parse request
                </Button>
                <Button variant="secondary" onClick={() => { setTranscript(""); setResponse(null); setStep("idle"); }}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security rules</CardTitle>
              <CardDescription>Non-negotiable controls for every action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border p-3">JWT session validation before every action.</div>
              <div className="rounded-lg border p-3">Company scope resolved server-side, never trusted from the browser.</div>
              <div className="rounded-lg border p-3">Permission key checked against the action registry.</div>
              <div className="rounded-lg border p-3">High-risk actions require confirmation and idempotency.</div>
              <div className="rounded-lg border p-3">AI usage and business lifecycle events are logged.</div>
            </CardContent>
          </Card>
        </div>

        {response && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Action review</CardTitle>
                  <CardDescription>{response.resultSummary || response.errorSummary || "Review the normalized request before execution."}</CardDescription>
                </div>
                <Badge variant={response.status === "permission_denied" || response.status === "failed" ? "destructive" : "outline"}>{response.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {intent && (
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Intent</p><p className="font-medium">{intent.normalizedIntent}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Module</p><p className="font-medium">{intent.targetModule}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Permission</p><p className="font-medium">{intent.requiredPermission || "None"}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Risk</p><Badge variant={riskBadgeVariant(intent.riskLevel)}>{intent.riskLevel}</Badge></div>
                </div>
              )}

              {response.status === "permission_denied" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Permission denied</AlertTitle>
                  <AlertDescription>{response.errorSummary || "Your current role cannot perform this action."}</AlertDescription>
                </Alert>
              )}

              {response.status === "pending_confirmation" && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Confirmation required</AlertTitle>
                  <AlertDescription>This action is medium or high risk and must be confirmed before execution.</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-2">
                {response.status === "pending_confirmation" && response.requestId ? (
                  <>
                    <Button onClick={handleConfirm} disabled={step === "executing"} className="gap-2">
                      {step === "executing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Confirm and execute
                    </Button>
                    <Button variant="outline" onClick={handleReject} className="gap-2"><XCircle className="h-4 w-4" />Reject</Button>
                  </>
                ) : intent && response.status !== "completed" && response.status !== "permission_denied" && response.status !== "failed" ? (
                  <Button onClick={handleExecute} disabled={step === "executing" || intent.requiresConfirmation} className="gap-2">
                    {step === "executing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Execute safe action
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent voice requests</CardTitle>
            <CardDescription>Local session view. Durable history is stored server-side in the voice action request ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : history.map((item, index) => (
              <div key={`${item.requestId || index}-${item.status}`} className="flex flex-col gap-1 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">{item.intent?.normalizedIntent || item.resultSummary || "Voice request"}</p>
                  <p className="text-xs text-muted-foreground">{item.intent?.targetModule || "system"} · {item.intent?.requiredPermission || "no permission required"}</p>
                </div>
                <Badge variant={item.status === "failed" || item.status === "permission_denied" ? "destructive" : "outline"}>{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
