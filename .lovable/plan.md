

# Fix: Realtime Channel Collision in `useLiveMonitorData`

## Root Cause

The channel name `live-monitor-${companyId}` is static. When React StrictMode double-mounts or the component remounts quickly, a new `useEffect` fires before the previous channel is fully cleaned up. Supabase reuses the existing channel object (already in `SUBSCRIBED` state) and throws: **"cannot add postgres_changes callbacks after subscribe()"**.

Same risk exists in `useLiveMonitorStats.ts`.

## Fix

Add a unique suffix (using `crypto.randomUUID()`) to each channel name so every mount gets a fresh channel. This is the standard Supabase pattern for hooks.

### File: `src/hooks/useLiveMonitorData.ts` (line 89)

```tsx
// Before
.channel(`live-monitor-${companyId || "global"}`)

// After
.channel(`live-monitor-${companyId || "global"}-${crypto.randomUUID()}`)
```

### File: `src/hooks/useLiveMonitorStats.ts` (line 139)

```tsx
// Before
.channel(`live-monitor-stats-${companyId || "global"}`)

// After
.channel(`live-monitor-stats-${companyId || "global"}-${crypto.randomUUID()}`)
```

Two lines changed across two files. No other modifications needed.

