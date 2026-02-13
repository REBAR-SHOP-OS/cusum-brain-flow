import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { reportToVizzy } from "@/lib/vizzyAutoReport";

/**
 * Global error handler that catches:
 * - Unhandled promise rejections
 * - Uncaught runtime errors
 * - Network failures (fetch errors)
 * 
 * Shows user-friendly toasts and logs to localStorage for diagnostics.
 */
export function useGlobalErrorHandler() {
  // Track repeated errors for auto-escalation to Vizzy
  const errorCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    const escalateIfRepeated = (type: string, message: string) => {
      const key = `${type}:${message.slice(0, 80)}`;
      errorCounts.current[key] = (errorCounts.current[key] || 0) + 1;
      // If same error happens 3+ times in a session, report to Vizzy
      if (errorCounts.current[key] === 3) {
        reportToVizzy(
          `Repeated ${type}: ${message}`,
          `Global handler on ${window.location.pathname}`
        );
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const message = event.reason?.message || String(event.reason) || "Unknown async error";
      if (isIgnoredError(message)) return;

      console.error("[GlobalErrorHandler] Unhandled rejection:", event.reason);
      logError("unhandled_rejection", message);
      escalateIfRepeated("unhandled_rejection", message);

      toast.error("Something went wrong", {
        description: truncate(message, 100),
        duration: 5000,
      });
    };

    const handleError = (event: ErrorEvent) => {
      const message = event.message || "Unknown error";
      if (isIgnoredError(message)) return;

      console.error("[GlobalErrorHandler] Uncaught error:", event.error);
      logError("uncaught_error", message);
      escalateIfRepeated("uncaught_error", message);

      if (!message.includes("Minified React error") && !message.includes("render")) {
        toast.error("Unexpected error", {
          description: truncate(message, 100),
          duration: 5000,
        });
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);
}

function isIgnoredError(message: string): boolean {
  const ignored = [
    "ResizeObserver loop",
    "Loading chunk",
    "dynamically imported module",
    "AbortError",
    "The user aborted",
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "cancelled",
    "error_type",
  ];
  return ignored.some((pattern) => message.includes(pattern));
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function logError(type: string, message: string) {
  try {
    const log = JSON.parse(localStorage.getItem("app_error_log") || "[]");
    log.push({
      timestamp: new Date().toISOString(),
      error: `[${type}] ${message}`,
      componentStack: "",
      url: window.location.href,
      autoRecovered: false,
    });
    // Keep last 50
    localStorage.setItem("app_error_log", JSON.stringify(log.slice(-50)));
  } catch {
    // Storage unavailable
  }
}
