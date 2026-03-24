import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { Bug, Copy, Check, ExternalLink, Trash2, RefreshCw, AlertTriangle, AlertCircle, Info, Wand2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FixRequest {
  id: string;
  description: string;
  photo_url: string | null;
  affected_area: string | null;
  status: string;
  created_at: string;
}

type Severity = "critical" | "warning" | "info";

function classifySeverity(description: string): Severity {
  const lower = description.toLowerCase();
  if (lower.includes("auto-recovery failed") || lower.includes("unrecoverable")) return "critical";
  if (lower.includes("repeated") || lower.includes("3+ times")) return "warning";
  return "info";
}

function isUserActionable(description: string): string | null {
  const lower = description.toLowerCase();
  if (lower.includes("auth") || lower.includes("login") || lower.includes("session") || lower.includes("token"))
    return "User may need to re-login";
  if (lower.includes("permission")) return "User may need permission update";
  if (lower.includes("storage") || lower.includes("cache")) return "User may need to clear cache";
  return null;
}

const SEVERITY_CONFIG: Record<Severity, { icon: typeof Bug; color: string; label: string }> = {
  critical: { icon: AlertCircle, color: "text-destructive", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-amber-500", label: "Warning" },
  info: { icon: Info, color: "text-blue-400", label: "Info" },
};

const POLL_INTERVAL = 5 * 60 * 1000;

/** Classify a fix request into a fixable category */
function classifyFixType(req: FixRequest): "stale" | "auth" | "cache" | "operational" {
  const desc = req.description.toLowerCase();
  const age = Date.now() - new Date(req.created_at).getTime();
  const isAutoDetected = desc.includes("🤖") || desc.includes("auto-detected");

  // Stale auto-detected errors (>30 min old)
  if (isAutoDetected && age > 30 * 60 * 1000) return "stale";

  // Auth/session errors
  if (desc.includes("auth") || desc.includes("session") || desc.includes("token") || desc.includes("login"))
    return "auth";

  // Cache/storage errors
  if (desc.includes("cache") || desc.includes("storage")) return "cache";

  return "operational";
}

export function FixRequestQueue() {
  const [requests, setRequests] = useState<FixRequest[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const prevCountRef = useRef(0);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from("vizzy_fix_requests" as any)
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const items = data as any as FixRequest[];

      // Auto-resolve duplicates (same description within 10 min window)
      const seen = new Map<string, FixRequest>();
      const dupeIds: string[] = [];
      for (const req of items) {
        const key = req.description;
        const existing = seen.get(key);
        if (existing) {
          const diff = Math.abs(new Date(req.created_at).getTime() - new Date(existing.created_at).getTime());
          if (diff < 10 * 60 * 1000) {
            if (new Date(req.created_at) > new Date(existing.created_at)) {
              dupeIds.push(existing.id);
              seen.set(key, req);
            } else {
              dupeIds.push(req.id);
            }
            continue;
          }
        }
        seen.set(key, req);
      }

      if (dupeIds.length > 0) {
        supabase
          .from("vizzy_fix_requests" as any)
          .update({ status: "resolved", resolved_at: new Date().toISOString() } as any)
          .in("id", dupeIds)
          .then(() => {});
      }

      const deduped = items.filter((r) => !dupeIds.includes(r.id));

      if (prevCountRef.current > 0 && deduped.length > prevCountRef.current) {
        const newCount = deduped.length - prevCountRef.current;
        toast.warning(`${newCount} new fix request${newCount > 1 ? "s" : ""} logged by Vizzy`);
      }
      prevCountRef.current = deduped.length;
      setRequests(deduped);
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  /** Smart FIX ALL — categorizes and takes real action per error type */
  const handleFixAll = async () => {
    if (requests.length === 0) return;
    setFixingAll(true);

    const summary = { stale: 0, auth: 0, cache: 0, operational: 0 };
    const operationalRequests: FixRequest[] = [];
    const directResolveIds: string[] = [];

    for (const req of requests) {
      const type = classifyFixType(req);
      summary[type]++;

      if (type === "stale") {
        directResolveIds.push(req.id);
      } else if (type === "auth") {
        directResolveIds.push(req.id);
      } else if (type === "cache") {
        directResolveIds.push(req.id);
      } else {
        operationalRequests.push(req);
      }
    }

    // 1. Refresh session for auth errors
    if (summary.auth > 0) {
      try {
        await supabase.auth.refreshSession();
      } catch { /* silent */ }
    }

    // 2. Clear vizzy report dedup keys for cache errors
    if (summary.cache > 0 || summary.auth > 0) {
      try {
        const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("vizzy_report:"));
        keys.forEach((k) => sessionStorage.removeItem(k));
      } catch { /* silent */ }
    }

    // 3. Resolve stale/auth/cache directly
    if (directResolveIds.length > 0) {
      await supabase
        .from("vizzy_fix_requests" as any)
        .update({ status: "resolved", resolved_at: new Date().toISOString() } as any)
        .in("id", directResolveIds);
    }

    // 4. Send operational issues to edge function for real action
    if (operationalRequests.length > 0) {
      try {
        const { error } = await supabase.functions.invoke("vizzy-erp-action", {
          body: {
            action: "bulk_fix_requests",
            params: {
              fix_requests: operationalRequests.map((r) => ({
                id: r.id,
                description: r.description,
                affected_area: r.affected_area,
              })),
            },
          },
        });
        if (error) console.warn("[FixAll] Edge function error:", error);
      } catch (err) {
        console.warn("[FixAll] Failed to send to edge function:", err);
      }
    }

    // Build summary toast
    const parts: string[] = [];
    if (summary.stale > 0) parts.push(`${summary.stale} stale cleared`);
    if (summary.auth > 0) parts.push(`${summary.auth} session refreshed`);
    if (summary.cache > 0) parts.push(`${summary.cache} cache reset`);
    if (summary.operational > 0) parts.push(`${summary.operational} sent to Vizzy`);
    toast.success(parts.join("، ") || "All resolved");

    setRequests([]);
    prevCountRef.current = 0;
    setFixingAll(false);
  };

  const copyToClipboard = (req: FixRequest) => {
    const text = `🐛 Fix Request from Vizzy:\n- Issue: ${req.description}\n- Area: ${req.affected_area || "Not specified"}\n- Logged: ${new Date(req.created_at).toLocaleString()}${req.photo_url ? `\n- Photo: ${req.photo_url}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(req.id);
    toast.success("Copied to clipboard — paste in Lovable chat");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resolveRequest = async (id: string) => {
    await supabase
      .from("vizzy_fix_requests" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString() } as any)
      .eq("id", id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Marked as resolved");
  };

  const handleAutoFix = async (req: FixRequest) => {
    setGeneratingId(req.id);
    try {
      const result = await invokeEdgeFunction<{ prompt: string }>("generate-fix-prompt", {
        title: req.affected_area || "Fix Request",
        description: req.description,
        screenshots: req.photo_url ? [req.photo_url] : [],
        priority: classifySeverity(req.description),
        source: "vizzy_auto_fix",
      });
      await navigator.clipboard.writeText(result.prompt);
      toast.success("Fix command copied to clipboard — paste in Lovable chat");
      await resolveRequest(req.id);
    } catch (err: any) {
      toast.error("Auto-fix failed", { description: err.message });
    } finally {
      setGeneratingId(null);
    }
  };

  const generateLovableCommand = async (req: FixRequest) => {
    setGeneratingId(req.id);
    try {
      const result = await invokeEdgeFunction<{ prompt: string }>("generate-fix-prompt", {
        title: req.affected_area || "Fix Request",
        description: req.description,
        screenshots: req.photo_url ? [req.photo_url] : [],
        priority: classifySeverity(req.description),
        source: "vizzy_fix_request",
      });
      setGeneratedPrompt(result.prompt);
      setPromptDialogOpen(true);
    } catch (err: any) {
      toast.error("Failed to generate command", { description: err.message });
    } finally {
      setGeneratingId(null);
    }
  };

  const copyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      toast.success("Lovable command copied — paste it in chat");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bug className="w-5 h-5 text-destructive" />
        <h3 className="font-semibold text-sm">Vizzy Fix Requests</h3>
        {requests.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{requests.length} open</span>
        )}
        {requests.length > 0 && (
          <button
            onClick={handleFixAll}
            disabled={fixingAll}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-primary hover:text-primary/80 disabled:opacity-50"
            title="Smart Fix All — resolves stale, refreshes sessions, sends operational issues to Vizzy"
          >
            <Wand2 className={`w-3.5 h-3.5 ${fixingAll ? "animate-spin" : ""}`} />
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Refresh now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open fix requests — tell Vizzy to log one from the shop floor.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {requests.map((req) => {
            const severity = classifySeverity(req.description);
            const svConfig = SEVERITY_CONFIG[severity];
            const SeverityIcon = svConfig.icon;
            const actionHint = isUserActionable(req.description);

            return (
              <div key={req.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <SeverityIcon className={`w-3.5 h-3.5 ${svConfig.color} shrink-0`} />
                    <span className={`text-[10px] font-medium uppercase ${svConfig.color}`}>{svConfig.label}</span>
                  </div>
                  <p className="font-medium text-foreground">{req.description}</p>
                  {req.affected_area && (
                    <p className="text-xs text-muted-foreground mt-0.5">Area: {req.affected_area}</p>
                  )}
                  {actionHint && (
                    <p className="text-xs text-amber-400 mt-0.5 font-medium">⚡ {actionHint}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => generateLovableCommand(req)}
                    disabled={generatingId === req.id}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-primary hover:text-primary/80 disabled:opacity-50"
                    title="Generate Lovable fix command"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${generatingId === req.id ? "animate-pulse" : ""}`} />
                  </button>
                  {req.photo_url && (
                    <a href={req.photo_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => copyToClipboard(req)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {copiedId === req.id ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => resolveRequest(req.id)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-right">
        Last checked: {lastChecked.toLocaleTimeString()} · Auto-refreshes every 5 min
      </p>

      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Lovable Fix Command
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] rounded-lg bg-muted p-4">
            <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">{generatedPrompt}</pre>
          </div>
          <button
            onClick={copyPrompt}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2 px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy to Clipboard
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
