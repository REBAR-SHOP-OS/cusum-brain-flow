# Vizzy Web — Production Knowledge Book

> Hard-won lessons from building Vizzy Web. Keep this document updated as new patterns emerge.

---

## Table of Contents

1. [Mobile Audio Playback (iOS Safari + Chrome)](#1-mobile-audio-playback-ios-safari--chrome)
2. [Auth Session Resilience](#2-auth-session-resilience)
3. [Realtime Subscriptions](#3-realtime-subscriptions)
4. [Notification System Architecture](#4-notification-system-architecture)
5. [Error Handling and Auto-Reporting](#5-error-handling-and-auto-reporting)
6. [Knowledge Base / RAG Import](#6-knowledge-base--rag-import)
7. [Edge Function Patterns](#7-edge-function-patterns)
8. [Storage and Signed URLs](#8-storage-and-signed-urls)
9. [General React Patterns](#9-general-react-patterns)
10. [Common Gotchas](#10-common-gotchas)

---

## 1. Mobile Audio Playback (iOS Safari + Chrome)

### Problem

iOS kills `HTMLAudioElement.play()` if **any** `await` sits between the user tap and the play call. The browser revokes the "user gesture" privilege as soon as the microtask yields.

### Solution — "Prime and Replay"

Synchronously call `.play()` with a silent WAV data URI during the gesture handler, then swap `src` after async work completes.

```ts
// audioPlayer.ts — simplified pattern
const SILENT_WAV = "data:audio/wav;base64,UklGRiQA..."; // minimal silent WAV

export function primeAndPlay(audioEl: HTMLAudioElement, realSrc: string) {
  // 1. Synchronous play with silent source — keeps gesture alive
  audioEl.src = SILENT_WAV;
  audioEl.play(); // no await!

  // 2. After async work, swap to real source
  setTimeout(() => {
    audioEl.src = realSrc;
    audioEl.play().catch(() => {});
  }, 50);
}
```

### AudioContext Suspension

- AudioContext gets suspended on tab switch / screen lock.
- Listen for `statechange` and re-arm unlock listeners:

```ts
audioCtx.addEventListener("statechange", () => {
  if (audioCtx.state === "suspended") {
    // Re-attach user-gesture listeners to resume
    attachUnlockListeners();
  }
});
```

- **Never** use `{ once: true }` on unlock listeners — keep retrying until `audioCtx.state === "running"` is confirmed.
- Pre-cache decoded `AudioBuffer`s at unlock time so notification sounds play instantly.

---

## 2. Auth Session Resilience

### Problem

Stale or corrupt tokens in `localStorage` cause infinite `bad_jwt` polling loops against the auth endpoint.

### Solution

```ts
// In AuthProvider — set up listener FIRST, then check session
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    if (event === "TOKEN_REFRESHED" && !session) {
      // Token refresh returned nothing — clear stale state
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setSession(null);
      setUser(null);
      return;
    }
    setSession(session);
    setUser(session?.user ?? null);
  }
);

// Then check existing session
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.warn("Session recovery failed:", error.message);
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setSession(null);
    setUser(null);
    return;
  }
  setSession(session);
  setUser(session?.user ?? null);
});
```

### Key Rules

- Always set up `onAuthStateChange` **before** calling `getSession()` to avoid race conditions.
- `signOut({ scope: 'local' })` only clears local storage — it doesn't hit the server.

---

## 3. Realtime Subscriptions

### Best Practices

```ts
useEffect(() => {
  const channel = supabase
    .channel("my-channel")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`, // Always filter by user
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          setState((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          // Remove dismissed items from state
          if (payload.new.dismissed) {
            setState((prev) => prev.filter((n) => n.id !== payload.new.id));
          }
        } else if (payload.eventType === "DELETE") {
          setState((prev) => prev.filter((n) => n.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel); // Prevent memory leaks
  };
}, [userId]);
```

### Key Rules

- **Always** filter by `user_id` in the subscription to avoid processing other users' events.
- **Always** clean up channels in the `useEffect` return.
- Handle INSERT / UPDATE / DELETE separately.

---

## 4. Notification System Architecture

### Permission Prompt

- Only ask **once** per device — use a `localStorage` flag (`notification_permission_asked`).
- Never re-prompt if the user denied; browsers will silently ignore the request anyway.

### Push Registration

- Skip registration if permission is not `"granted"`.
- Set `pushRegistered = false` on failure to allow retry on next app load.

### Sound Architecture

Keep notification logic decoupled from audio mechanics:

```
notificationSound.ts  →  audioPlayer.ts  →  HTMLAudioElement / AudioContext
       (what)                (how)                 (platform)
```

```ts
// notificationSound.ts — thin wrapper
import { playNotificationSound } from "./audioPlayer";

export function playMockingjayWhistle(): void {
  playNotificationSound("/mockingjay.mp3").catch((err) => {
    console.warn("[notificationSound] Failed:", err);
  });
}
```

---

## 5. Error Handling and Auto-Reporting

### Global Error Handler (`useGlobalErrorHandler`)

- Catches unhandled promise rejections and uncaught runtime errors.
- Filters out noise (see ignore list below).
- Auto-escalates: if the same error fires **3+ times** in a session, it reports to the `vizzy_fix_requests` table.

### Ignore List

```ts
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
  "not allowed by the user agent",
  "denied permission",
  "Permission denied",
  "push subscription",
];
```

### Deduplication

Use `sessionStorage` with a 5-minute cooldown key to avoid spamming reports:

```ts
const dedupeKey = `vizzy_report:${area}:${desc.slice(0, 80)}`;
const last = sessionStorage.getItem(dedupeKey);
if (last && Date.now() - Number(last) < 5 * 60 * 1000) return;
sessionStorage.setItem(dedupeKey, String(Date.now()));
```

### Error Log

Persist last 50 errors in `localStorage` under `app_error_log` for on-device diagnostics.

### SmartErrorBoundary

- Auto-retries rendering up to N times with exponential backoff (1s → 2s → 4s → 8s).
- Clears React Query cache between retries.
- After retries exhausted, reports to Vizzy and shows a recovery UI.

---

## 6. Knowledge Base / RAG Import

### Bulk Paste

- Split on `\n---\n`
- First line of each section becomes the **title**
- Rest becomes the **content**

### URL Scrape

- Use the `firecrawl-scrape` edge function to convert web pages to markdown.

### Defaults

- Always generate URL slugs from titles.
- Set `is_published: true` by default for imported content.

---

## 7. Edge Function Patterns

- **100+ edge functions** in production — keep each focused on a **single responsibility**.
- Shared utilities go in `supabase/functions/_shared/`.
- Secrets are managed via Lovable Cloud — **never hardcode API keys**.
- Each function should handle its own CORS headers:

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // ... handler logic
});
```

---

## 8. Storage and Signed URLs

```ts
import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_EXPIRY = 3600; // 1 hour

export async function getSignedFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("estimation-files")
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL:", error);
    return ""; // Caller decides how to handle
  }

  return data.signedUrl;
}
```

### Key Rules

- Use `createSignedUrl()` with a 1-hour expiry.
- Always handle the error case gracefully — return empty string, let caller decide.

---

## 9. General React Patterns

### useCallback

Use `useCallback` for **all** functions passed to child components or used in dependency arrays.

### Optimistic UI Updates

Apply the state change immediately, revert on API error:

```ts
const handleToggle = useCallback(async (id: string) => {
  // Optimistic
  setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const { error } = await supabase.from("items").update({ done: true }).eq("id", id);
  if (error) {
    // Revert
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    toast.error("Failed to update");
  }
}, []);
```

### useCompanyId

Centralizes workspace context. Always check for `null` before writes:

```ts
const { companyId } = useCompanyId();

const handleCreate = async () => {
  if (!companyId) return; // Guard
  await supabase.from("projects").insert({ company_id: companyId, name: "New" });
};
```

---

## 10. Common Gotchas

| Gotcha | Detail |
|--------|--------|
| **Query limit** | Default is 1000 rows. Paginate or increase limit when debugging "missing data". |
| **Auto-generated files** | Never edit `client.ts`, `types.ts`, `config.toml`, `.env` — they're overwritten automatically. |
| **`as any` casts** | Indicates a table exists in the DB but isn't in generated types yet. Acceptable during rapid iteration, clean up later. |
| **RLS + auth** | If you add RLS policies, you **must** also implement authentication — otherwise users can't CRUD at all. |
| **Edge function secrets** | Always check configured secrets before deploying. Missing secrets = silent failures. |
| **Realtime publication** | Tables must be added to `supabase_realtime` publication: `ALTER PUBLICATION supabase_realtime ADD TABLE public.my_table;` |

---

*Last updated: 2026-02-15*
