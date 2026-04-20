/**
 * Shared classifier for edge-function failures.
 * Maps known HTTP statuses (402, 429, 401/403) and message patterns
 * into user-friendly toast { title, description } pairs so every Ad Director
 * entry point shows the same wording for the same failure.
 */

export interface EdgeFunctionErrorInfo {
  title: string;
  description: string;
  /** True when the failure is a known business/billing/rate-limit case (not a bug). */
  recoverable: boolean;
  status?: number;
}

export function classifyEdgeFunctionError(
  err: unknown,
  fallbackTitle = "Request failed",
): EdgeFunctionErrorInfo {
  const anyErr = err as { status?: number; message?: string; cause?: { status?: number } } | null;
  const status = anyErr?.status ?? anyErr?.cause?.status;
  const rawMessage = (anyErr?.message ?? "").toString();
  const lower = rawMessage.toLowerCase();

  if (status === 402 || lower.includes("ai credits exhausted") || lower.includes("payment required")) {
    return {
      title: "AI credits exhausted",
      description: "Add funds in Settings → Workspace → Cloud & AI balance, then try again.",
      recoverable: true,
      status: 402,
    };
  }
  if (status === 429 || lower.includes("rate limit")) {
    return {
      title: "Rate limit reached",
      description: "Please wait a moment and try again.",
      recoverable: true,
      status: 429,
    };
  }
  if (status === 401 || status === 403 || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return {
      title: "Access denied",
      description: "You don't have permission for this action. Try signing in again.",
      recoverable: true,
      status,
    };
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return {
      title: "Request timed out",
      description: "The AI took too long to respond. Please try again.",
      recoverable: true,
      status,
    };
  }
  return {
    title: fallbackTitle,
    description: rawMessage || "Something went wrong. Please try again.",
    recoverable: false,
    status,
  };
}

/** Returns true for errors the pipeline should NOT rethrow (handled gracefully via toast). */
export function isRecoverableEdgeError(err: unknown): boolean {
  return classifyEdgeFunctionError(err).recoverable;
}
