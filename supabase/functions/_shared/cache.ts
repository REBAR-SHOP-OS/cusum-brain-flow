/**
 * In-memory TTL cache for Deno edge functions.
 * Deno isolates persist module-level state across warm invocations,
 * making this an effective cache without external infrastructure.
 *
 * Keys should be scoped by companyId for tenant isolation.
 * Cache auto-evicts oldest entries when MAX_ENTRIES is exceeded.
 */

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
  lastAccessed: number;
}

const store = new Map<string, CacheEntry>();
const MAX_ENTRIES = 500;

/** Get a cached value. Returns undefined if missing or expired. */
export function cacheGet<T = unknown>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  entry.lastAccessed = Date.now();
  return entry.data as T;
}

/** Set a cached value with TTL in milliseconds. */
export function cacheSet<T = unknown>(key: string, data: T, ttlMs: number): void {
  // Evict if at capacity — remove oldest accessed entries
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [k, v] of store) {
      if (v.lastAccessed < oldestTime) {
        oldestTime = v.lastAccessed;
        oldestKey = k;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }

  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    lastAccessed: Date.now(),
  });
}

/**
 * Cache-through helper. Returns cached data if fresh, otherwise calls fetchFn,
 * caches the result, and returns it.
 *
 * @param key   Cache key (scope with companyId for tenant isolation)
 * @param ttlMs Time-to-live in milliseconds
 * @param fetchFn Async function that fetches fresh data
 */
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const fresh = await fetchFn();
  cacheSet(key, fresh, ttlMs);
  return fresh;
}

/** Clear all cache entries (useful for testing). */
export function cacheClear(): void {
  store.clear();
}

/** Current cache size (for diagnostics). */
export function cacheSize(): number {
  return store.size;
}
