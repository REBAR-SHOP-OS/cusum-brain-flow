

## Plan: Add Server-Side In-Memory Cache for Edge Functions

### Problem
Edge functions like `buildFullVizzyContext`, `fetchExecutiveContext`, and agent context builders hit PostgreSQL with 10-18 parallel queries on every invocation. For data that changes infrequently (company settings, machine lists, customer counts, knowledge base), this creates unnecessary database load and adds latency.

### Approach
Create a shared in-memory cache module for Deno edge functions. Deno workers persist between invocations (warm starts), making module-level `Map` objects an effective TTL cache — no external infrastructure needed.

### Changes

**1. New file: `supabase/functions/_shared/cache.ts`**
- Simple TTL cache using a module-level `Map<string, { data: any; expiresAt: number }>`
- Exports: `cacheGet(key)`, `cacheSet(key, data, ttlMs)`, `cachedQuery(key, ttlMs, fetchFn)` — the last one is a cache-through helper
- Default TTL: 60 seconds (configurable per call)
- Max entries cap (~500) with LRU eviction to prevent memory leaks
- Keys scoped by `companyId` to maintain tenant isolation

**2. Update: `supabase/functions/_shared/vizzyFullContext.ts`**
- Wrap slow-changing queries (machines, knowledge, profiles, stock summary) with `cachedQuery()` using 2-5 minute TTLs
- Keep fast-changing queries (active orders, recent events, time clock) uncached
- Expected: reduce from ~18 DB queries to ~8 on warm cache hits

**3. Update: `supabase/functions/_shared/agentExecutiveContext.ts`**
- Cache customer count (10 min TTL), accounting mirror aggregates (2 min TTL)
- Keep realtime data (activity events, chat sessions) uncached

**4. Update: `supabase/functions/_shared/agentContext.ts`** (if exists)
- Apply same pattern to agent-specific context fetches for company playbooks, strategies

### TTL Strategy
| Data Type | TTL | Reason |
|-----------|-----|--------|
| Machine list | 5 min | Rarely changes |
| Knowledge base | 10 min | Updated infrequently |
| Customer/profile counts | 10 min | Slow-moving |
| Stock summary | 2 min | Changes with production |
| AR/AP aggregates | 2 min | Changes with invoicing |
| Active orders, events | 0 (no cache) | Must be realtime |

### Technical Details
- Deno isolates persist module state across warm invocations — this is the standard caching pattern for Supabase Edge Functions
- No database tables, no Redis, no external dependencies
- Cache is per-isolate so it's automatically cleared on cold starts or redeployments
- Tenant safety: all cache keys prefixed with `companyId`
- The `cachedQuery` helper signature: `cachedQuery<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>`

### Client-Side (Already Handled)
The React hooks already use `staleTime` and `refetchInterval` effectively — no changes needed on the frontend.

