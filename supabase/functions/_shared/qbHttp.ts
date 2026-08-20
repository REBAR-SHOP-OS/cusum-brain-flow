/**
 * Shared QuickBooks HTTP utilities for security, reliability, and observability.
 * Used by qb-webhook, qb-sync-engine, and quickbooks-oauth.
 */

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings are compared byte-by-byte; the result is XOR-accumulated
 * so that the execution time does not vary with the position of the first mismatch.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Fetch wrapper with AbortController timeout.
 * Throws on timeout with a descriptive error.
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns true for HTTP status codes that indicate a transient server error
 * worth retrying: 429 (rate limit), 502, 503, 504 (gateway/server errors).
 */
export function isTransientError(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Exponential backoff with jitter.
 * Base delay doubles each retry, capped at 10s, with ±50% jitter.
 */
export function backoffWithJitter(retryCount: number): number {
  const base = Math.min(1000 * Math.pow(2, retryCount), 10_000);
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

/**
 * Structured log entry for QB API calls.
 * Never logs tokens or secrets.
 */
export interface QBCallLog {
  company_id?: string;
  realm_id?: string;
  endpoint: string;
  operation?: string;
  duration_ms: number;
  status_code: number;
  retry_count: number;
  error_message?: string;
  correlation_id?: string;
}

export function logQBCall(entry: QBCallLog): void {
  console.log(`[QB-API] ${JSON.stringify(entry)}`);
}
