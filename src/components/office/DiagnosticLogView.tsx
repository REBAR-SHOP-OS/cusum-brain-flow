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
  Shield,
  Zap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SUPER_ADMIN_EMAIL = "sattar@rebar.shop";

type LogType = "edge" | "auth" | "postgres";

interface LogEntry {
  id: string;
  timestamp: string | number;
  event_message: string;
  // Edge-specific
  status_code?: number;
  method?: string;
  function_id?: string;
  execution_time_ms?: number;
  // Auth-specific
  level?: string;
  status?: number;
  path?: string;
  msg?: string;
  error?: string;
  // Postgres-specific
  identifier?: string;
  error_severity?: string;
}

const logTypeConfig: Record<LogType, { label: string; icon: React.ElementType; description: string }> = {
  edge: { label: "Edge Function Logs", icon: Zap, description: "Edge function execution with request/response data" },
  auth: { label: "Authentication Logs", icon: Shield, description: "User authentication events and security logs" },
  postgres: { label: "PostgreSQL Logs", icon: Database, description: "Database queries, errors, and performance metrics" },
};

function getStatusColor(status?: number | string): string {
  if (!status) return "text-muted-foreground";
  const code = typeof status === "string" ? parseInt(status) : status;
  if (code >= 200 && code < 300) return "text-emerald-500";
  if (code >= 300 && code < 400) return "text-amber-500";
  if (code >= 400 && code < 500) return "text-orange-500";
  if (code >= 500) return "text-destructive";
  return "text-muted-foreground";
}

function getSeverityColor(severity?: string): string {
  if (!severity) return "bg-muted text-muted-foreground";
  const s = severity.toUpperCase();
  if (s === "ERROR" || s === "FATAL" || s === "PANIC") return "bg-destructive/15 text-destructive";
  if (s === "WARNING") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (s === "LOG" || s === "INFO") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return "bg-muted text-muted-foreground";
}

function formatTimestamp(ts: string | number): string {
  try {
    const d = typeof ts === "number" ? new Date(ts / 1000) : new Date(ts);
    return format(d, "dd MMM HH:mm:ss");
  } catch {
    return String(ts);
  }
}

export function DiagnosticLogView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logType, setLogType] = useState<LogType>("edge");
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-logs", {
        body: { logType, search: searchTerm, limit: 100 },
      });

      if (error) throw error;

      // The analytics API returns data in different formats
      const rawLogs = data?.logs || [];
      
      // Handle both array and result format
      const parsedLogs: LogEntry[] = Array.isArray(rawLogs) 
        ? rawLogs.map((row: any, i: number) => ({
            id: row.id || `log-${i}`,
            timestamp: row.timestamp,
            event_message: row.event_message || "",
            status_code: row.status_code,
            method: row.method,
            function_id: row.function_id,
            execution_time_ms: row.execution_time_ms,
            level: row.level,
            status: row.status,
            path: row.path,
            msg: row.msg,
            error: row.error,
            identifier: row.identifier,
            error_severity: row.error_severity,
          }))
        : [];

      setLogs(parsedLogs);
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
    const text = logs.map((l) => `${formatTimestamp(l.timestamp)} | ${l.event_message}`).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Logs copied to clipboard" });
  };

  const handleDownloadLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-${logType}-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Access denied for non-super-admin
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
          {/* Log type selector */}
          <Select value={logType} onValueChange={(v) => { setLogType(v as LogType); setLogs([]); setHasLoaded(false); }}>
            <SelectTrigger className="w-52 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(logTypeConfig) as [LogType, typeof logTypeConfig.edge][]).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <config.icon className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
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

          {/* Fetch button */}
          <Button onClick={fetchLogs} disabled={loading} size="sm" className="gap-1.5 h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Loading..." : "Fetch Logs"}
          </Button>

          {/* Actions */}
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
              <Terminal className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Select a log type and click "Fetch Logs" to load entries.</p>
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
                  logType={logType}
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
  logType,
  expanded,
  onToggle,
}: {
  log: LogEntry;
  logType: LogType;
  expanded: boolean;
  onToggle: () => void;
}) {
  const severity = logType === "postgres"
    ? log.error_severity
    : logType === "auth"
    ? log.level
    : log.status_code
    ? (log.status_code >= 400 ? "ERROR" : "LOG")
    : "LOG";

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

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">
          {formatTimestamp(log.timestamp)}
        </span>

        {/* Severity badge */}
        <Badge
          variant="secondary"
          className={cn("text-[10px] font-mono px-1.5 py-0 shrink-0", getSeverityColor(severity))}
        >
          {severity || "LOG"}
        </Badge>

        {/* Method + Status for edge logs */}
        {logType === "edge" && log.method && (
          <span className="text-xs font-mono font-medium shrink-0">
            {log.method}
            {log.status_code != null && (
              <span className={cn("ml-2", getStatusColor(log.status_code))}>
                {log.status_code}
              </span>
            )}
          </span>
        )}

        {/* Auth status */}
        {logType === "auth" && log.status != null && (
          <span className={cn("text-xs font-mono font-medium shrink-0", getStatusColor(log.status))}>
            {log.status}
          </span>
        )}

        {/* Message */}
        <span className="text-xs text-foreground/80 font-mono truncate flex-1">
          {log.event_message}
        </span>

        {/* Execution time for edge */}
        {logType === "edge" && log.execution_time_ms != null && (
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {log.execution_time_ms}ms
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <Card className="ml-10 mr-4 mb-2 mt-1 border-border/50">
          <CardContent className="p-4 space-y-2">
            <DetailField label="Event Message" value={log.event_message} />
            <DetailField label="Timestamp" value={String(log.timestamp)} />
            <DetailField label="ID" value={log.id} />

            {logType === "edge" && (
              <>
                <DetailField label="Method" value={log.method} />
                <DetailField label="Status Code" value={log.status_code?.toString()} />
                <DetailField label="Function ID" value={log.function_id} />
                <DetailField label="Execution Time" value={log.execution_time_ms ? `${log.execution_time_ms}ms` : undefined} />
              </>
            )}

            {logType === "auth" && (
              <>
                <DetailField label="Level" value={log.level} />
                <DetailField label="Status" value={log.status?.toString()} />
                <DetailField label="Path" value={log.path} />
                <DetailField label="Message" value={log.msg} />
                <DetailField label="Error" value={log.error} />
              </>
            )}

            {logType === "postgres" && (
              <>
                <DetailField label="Identifier" value={log.identifier} />
                <DetailField label="Severity" value={log.error_severity} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs font-mono text-foreground break-all">{value}</span>
    </div>
  );
}
