/**
 * In-memory circuit breaker for AI providers.
 * Tracks failures per provider and transitions between states:
 *   closed (normal) → open (blocked) → half-open (test one request)
 *
 * Trips on: 5 consecutive failures OR >20% error rate in 5-minute window.
 * Half-open: allows 1 test request after 60s cooldown.
 * Auto-recovers on successful test.
 *
 * Flag-gated: only active when ENABLE_CIRCUIT_BREAKER is set.
 */

interface BreakerState {
  state: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  recentResults: { ok: boolean; ts: number }[];
  openedAt: number;
  halfOpenInFlight: boolean;
}

const breakers = new Map<string, BreakerState>();

const MAX_CONSECUTIVE = 5;
const ERROR_RATE_THRESHOLD = 0.2; // 20%
const WINDOW_MS = 5 * 60_000; // 5 minutes
const COOLDOWN_MS = 60_000; // 60 seconds before half-open
const MIN_SAMPLES = 10; // need at least 10 calls to evaluate error rate

function getOrCreate(provider: string): BreakerState {
  let b = breakers.get(provider);
  if (!b) {
    b = {
      state: "closed",
      consecutiveFailures: 0,
      recentResults: [],
      openedAt: 0,
      halfOpenInFlight: false,
    };
    breakers.set(provider, b);
  }
  return b;
}

function pruneWindow(b: BreakerState): void {
  const cutoff = Date.now() - WINDOW_MS;
  b.recentResults = b.recentResults.filter((r) => r.ts > cutoff);
}

function errorRate(b: BreakerState): number {
  if (b.recentResults.length < MIN_SAMPLES) return 0;
  const failures = b.recentResults.filter((r) => !r.ok).length;
  return failures / b.recentResults.length;
}

/** Check if the breaker is open (provider should be skipped). */
export function isBreakerOpen(provider: string): boolean {
  const b = getOrCreate(provider);

  if (b.state === "closed") return false;

  if (b.state === "open") {
    // Check cooldown for half-open transition
    if (Date.now() - b.openedAt >= COOLDOWN_MS) {
      b.state = "half-open";
      b.halfOpenInFlight = false;
      return false; // allow one test request
    }
    return true; // still blocked
  }

  // half-open: allow one request at a time
  if (b.state === "half-open") {
    if (b.halfOpenInFlight) return true; // already testing
    b.halfOpenInFlight = true;
    return false; // allow test
  }

  return false;
}

/** Record a successful call — resets breaker if half-open. */
export function recordSuccess(provider: string): void {
  const b = getOrCreate(provider);
  pruneWindow(b);
  b.recentResults.push({ ok: true, ts: Date.now() });
  b.consecutiveFailures = 0;

  if (b.state === "half-open") {
    b.state = "closed";
    b.halfOpenInFlight = false;
  }
}

/** Record a failed call — may trip breaker. */
export function recordFailure(provider: string): void {
  const b = getOrCreate(provider);
  pruneWindow(b);
  b.recentResults.push({ ok: false, ts: Date.now() });
  b.consecutiveFailures++;

  if (b.state === "half-open") {
    // Test failed — reopen
    b.state = "open";
    b.openedAt = Date.now();
    b.halfOpenInFlight = false;
    return;
  }

  // Check trip conditions
  if (
    b.consecutiveFailures >= MAX_CONSECUTIVE ||
    errorRate(b) > ERROR_RATE_THRESHOLD
  ) {
    b.state = "open";
    b.openedAt = Date.now();
    console.warn(
      `[circuit-breaker] OPEN for provider "${provider}" — consecutive=${b.consecutiveFailures}, errorRate=${(errorRate(b) * 100).toFixed(1)}%`,
    );
  }
}

/** Get current breaker state for diagnostics. */
export function getBreakerState(provider: string): {
  state: string;
  consecutiveFailures: number;
  errorRate: number;
  recentSamples: number;
} {
  const b = getOrCreate(provider);
  pruneWindow(b);
  return {
    state: b.state,
    consecutiveFailures: b.consecutiveFailures,
    errorRate: errorRate(b),
    recentSamples: b.recentResults.length,
  };
}

/** Reset a provider's breaker (for testing/manual recovery). */
export function resetBreaker(provider: string): void {
  breakers.delete(provider);
}
