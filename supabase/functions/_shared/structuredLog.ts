/**
 * Structured JSON logging for edge functions.
 * All output goes to stdout as JSON for log parsing/aggregation.
 * Purely additive — no existing function needs to change.
 */

interface LogMeta {
  functionName?: string;
  companyId?: string;
  userId?: string;
  requestId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function emit(level: "info" | "warn" | "error", message: string, meta?: LogMeta) {
  const entry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function logInfo(functionName: string, message: string, meta?: Omit<LogMeta, "functionName">) {
  emit("info", message, { functionName, ...meta });
}

export function logWarn(functionName: string, message: string, meta?: Omit<LogMeta, "functionName">) {
  emit("warn", message, { functionName, ...meta });
}

export function logError(
  functionName: string,
  message: string,
  error?: unknown,
  meta?: Omit<LogMeta, "functionName">,
) {
  const errInfo = error instanceof Error
    ? { errorMessage: error.message, errorStack: error.stack }
    : { errorMessage: String(error) };
  emit("error", message, { functionName, ...errInfo, ...meta });
}

/**
 * Create a scoped logger for a single function invocation.
 * Usage:
 *   const log = createLogger("my-function", { userId, companyId });
 *   log.info("Starting...");
 *   log.error("Failed", err);
 */
export function createLogger(functionName: string, baseMeta?: Omit<LogMeta, "functionName">) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const base: LogMeta = { functionName, requestId, ...baseMeta };

  return {
    info: (msg: string, extra?: Record<string, unknown>) =>
      emit("info", msg, { ...base, ...extra }),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      emit("warn", msg, { ...base, ...extra }),
    error: (msg: string, err?: unknown, extra?: Record<string, unknown>) => {
      const errInfo = err instanceof Error
        ? { errorMessage: err.message, errorStack: err.stack }
        : err ? { errorMessage: String(err) } : {};
      emit("error", msg, { ...base, ...errInfo, ...extra });
    },
    elapsed: () => Date.now() - startTime,
    done: (msg = "Completed", extra?: Record<string, unknown>) =>
      emit("info", msg, { ...base, durationMs: Date.now() - startTime, ...extra }),
  };
}
