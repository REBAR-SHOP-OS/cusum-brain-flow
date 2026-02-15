import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Terminal,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Download,
  Copy,
  Database,
  Zap,
  Loader2,
  AlertTriangle,
  Cog,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"];

type LogType = "events" | "commands" | "machine_runs" | "db_stats";

interface LogEntry {
  id: string;
  timestamp: string;
  event_message: string;
  level?: string;
  details?: Record<string, any>;
}

const logTypeConfig: Record<LogType, { label: string; icon: React.ElementType; description: string }> = {
  events: { label: "System Events", icon: Zap, description: "Application events and entity changes" },
  commands: { label: "Command Log", icon: Terminal, description: "User commands and AI parsed intents" },
  machine_runs: { label: "Machine Runs", icon: Cog, description: "Production machine run history" },
  db_stats: { label: "Database Stats", icon: Database, description: "Table sizes and row counts" },
};

function getSeverityColor(level?: string): string {
  if (!level) return "bg-muted text-muted-foreground";
  const s = level.toUpperCase();
  if (s === "ERROR" || s === "FATAL") return "bg-destructive/15 text-destructive";
  if (s === "WARNING") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (s === "INFO") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return "bg-muted text-muted-foreground";
}

function formatTimestamp(ts: string): string {
  try {
    return format(new Date(ts), "dd MMM HH:mm:ss");
  } catch {
    return ts;
  }
}

export function DiagnosticLogView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logType, setLogType] = useState<LogType>("events");
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email ?? "");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-logs", {
        body: { logType, search: searchTerm, limit: 100 },
      });

      if (error) throw error;
      setLogs(data?.logs || []);
      setHasLoaded(true);
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
      toast({
        title: "Failed to fetch logs",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
      setLogs([]);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [logType, searchTerm, toast]);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `${formatTimestamp(l.timestamp)} | ${l.level || "LOG"} | ${l.event_message}`).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Logs copied to clipboard" });
  };

  const handleDownloadLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-${logType}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-xl font-black italic text-foreground uppercase">Access Denied</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Diagnostic logs are restricted to super administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">
              Diagnostic Log
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Debug errors and track activity in your app.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs border-destructive/30 text-destructive">
            <ShieldAlert className="w-3 h-3" />
            Super Admin Only
          </Badge>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-5">
          <Select
            value={logType}
            onValueChange={(v) => {
              setLogType(v as LogType);
              setLogs([]);
              setHasLoaded(false);
            }}
          >
            <SelectTrigger className="w-52 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(logTypeConfig) as [LogType, (typeof logTypeConfig)["events"]][]).map(
                ([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
              className="pl-9 h-9"
            />
          </div>

          <Button onClick={fetchLogs} disabled={loading} size="sm" className="gap-1.5 h-9">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? "Loading..." : "Fetch Logs"}
          </Button>

          {logs.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleDownloadLogs}>
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleCopyLogs}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Logs body */}
      <ScrollArea className="flex-1">
        {!hasLoaded ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <History className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Select a log type and click "Fetch Logs" to load entries.
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No logs found for this query.</p>
          </div>
        ) : (
          <div className="px-6 py-3">
            <div className="text-xs text-muted-foreground mb-3">{logs.length} logs found</div>
            <div className="space-y-0.5">
              {logs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="group">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors",
          "hover:bg-secondary/50",
          expanded && "bg-secondary/70"
        )}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}

        <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">
          {formatTimestamp(log.timestamp)}
        </span>

        <Badge
          variant="secondary"
          className={cn("text-[10px] font-mono px-1.5 py-0 shrink-0", getSeverityColor(log.level))}
        >
          {log.level || "LOG"}
        </Badge>

        <span className="text-xs text-foreground/80 font-mono truncate flex-1">
          {log.event_message}
        </span>
      </button>

      {expanded && log.details && (
        <Card className="ml-10 mr-4 mb-2 mt-1 border-border/50">
          <CardContent className="p-4 space-y-2">
            {Object.entries(log.details).map(([key, value]) => {
              if (value == null || value === "") return null;
              const display =
                typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
              return (
                <div key={key} className="flex gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-32 shrink-0 pt-0.5">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-mono text-foreground break-all whitespace-pre-wrap">
                    {display}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
