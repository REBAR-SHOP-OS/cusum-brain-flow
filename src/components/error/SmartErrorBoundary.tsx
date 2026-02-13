import React, { Component, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from "lucide-react";
import { reportToVizzy } from "@/lib/vizzyAutoReport";

interface ErrorLogEntry {
  timestamp: string;
  error: string;
  componentStack: string;
  url: string;
  autoRecovered: boolean;
}

interface Props {
  children: React.ReactNode;
  fallbackRoute?: string;
  maxAutoRetries?: number;
  level?: "app" | "page" | "component";
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isAutoRecovering: boolean;
  showDetails: boolean;
  errorLog: ErrorLogEntry[];
}

/**
 * SmartErrorBoundary — An intelligent, self-healing error boundary.
 * 
 * Features:
 * - Auto-retries rendering up to N times with exponential backoff
 * - Logs errors to localStorage for diagnostics
 * - Clears stale query cache on recovery attempts
 * - Shows a polished recovery UI with details toggle
 * - Falls back to navigation if retries are exhausted
 */
export class SmartErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isAutoRecovering: false,
      showDetails: false,
      errorLog: this.loadErrorLog(),
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const maxRetries = this.props.maxAutoRetries ?? 3;
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      error: `${error.name}: ${error.message}`,
      componentStack: errorInfo.componentStack || "",
      url: window.location.href,
      autoRecovered: false,
    };

    // Save to log
    const log = [...this.state.errorLog, entry].slice(-50); // keep last 50
    this.saveErrorLog(log);
    this.setState({ errorInfo, errorLog: log });

    console.error("[SmartErrorBoundary] Caught error:", error);
    console.error("[SmartErrorBoundary] Component stack:", errorInfo.componentStack);

    // Auto-recovery: retry with exponential backoff
    if (this.state.retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 8000);
      this.setState({ isAutoRecovering: true });

      this.retryTimer = setTimeout(() => {
        this.clearQueryCache();
        this.setState((prev) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
          isAutoRecovering: false,
        }));
      }, delay);
    } else {
      // All retries exhausted — report to Vizzy
      const page = window.location.pathname;
      reportToVizzy(
        `${error.name}: ${error.message} (auto-recovery failed after ${maxRetries} attempts)`,
        `${this.props.level || "app"} error on ${page}`
      );
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private clearQueryCache() {
    try {
      // Attempt to clear react-query cache via window event
      window.dispatchEvent(new CustomEvent("smart-error-boundary-clear-cache"));
    } catch {
      // Silently fail
    }
  }

  private loadErrorLog(): ErrorLogEntry[] {
    try {
      const raw = localStorage.getItem("app_error_log");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveErrorLog(log: ErrorLogEntry[]) {
    try {
      localStorage.setItem("app_error_log", JSON.stringify(log));
    } catch {
      // Storage full or unavailable
    }
  }

  private handleRetry = () => {
    this.clearQueryCache();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isAutoRecovering: false,
    });
  };

  private handleGoHome = () => {
    window.location.href = this.props.fallbackRoute || "/home";
  };

  private handleClearLog = () => {
    localStorage.removeItem("app_error_log");
    this.setState({ errorLog: [] });
  };

  render() {
    const { hasError, error, errorInfo, isAutoRecovering, retryCount, showDetails, errorLog } = this.state;
    const maxRetries = this.props.maxAutoRetries ?? 3;
    const level = this.props.level || "app";

    if (!hasError) {
      return this.props.children;
    }

    // During auto-recovery, show a minimal spinner
    if (isAutoRecovering) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px] bg-background">
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Auto-recovering… (attempt {retryCount + 1}/{maxRetries})
            </p>
          </div>
        </div>
      );
    }

    // Full fallback UI after retries exhausted
    return (
      <div className={`flex items-center justify-center bg-background ${level === "app" ? "min-h-screen" : level === "page" ? "min-h-[60vh]" : "min-h-[200px]"}`}>
        <div className="max-w-lg w-full mx-4 p-6 rounded-2xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground">
                {retryCount >= maxRetries
                  ? `Auto-recovery failed after ${maxRetries} attempts`
                  : "An unexpected error occurred"}
              </p>
            </div>
          </div>

          {/* Error summary */}
          <div className="rounded-lg bg-muted/50 border border-border p-3 mb-4">
            <p className="text-sm text-foreground font-mono break-all">
              {error?.message || "Unknown error"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={this.handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>

          {/* Expandable details */}
          <button
            onClick={() => this.setState({ showDetails: !showDetails })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/30 text-xs text-muted-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" />
              Diagnostic Details ({errorLog.length} logged errors)
            </span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="mt-2 space-y-2">
              {/* Component stack */}
              {errorInfo?.componentStack && (
                <div className="rounded-lg bg-muted/30 border border-border p-2 max-h-32 overflow-auto">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Component Stack</p>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono">
                    {errorInfo.componentStack.trim().slice(0, 500)}
                  </pre>
                </div>
              )}

              {/* Recent error log */}
              {errorLog.length > 0 && (
                <div className="rounded-lg bg-muted/30 border border-border p-2 max-h-40 overflow-auto">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Error History</p>
                    <button
                      onClick={this.handleClearLog}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  {errorLog.slice(-5).reverse().map((entry, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground py-0.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground/60">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>{" "}
                      {entry.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
