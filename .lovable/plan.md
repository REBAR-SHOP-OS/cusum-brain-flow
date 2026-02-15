
# Fix "No Response from AI" in Website Chat

## Problem
The AI Website Editor chat on `/website` shows "No response from AI" when sending messages like "fix" or "whats happen". Three root causes identified:

## Root Causes

1. **`admin-chat` not registered in `config.toml`** -- Supabase gateway enforces JWT verification at the infrastructure level before the function code runs. Since the function does its own auth, it needs `verify_jwt = false` in config.toml (like every other function in the project).

2. **Tool-call timeout** -- When the AI decides to use tools (e.g., for "fix slugs"), the function buffers the entire first AI response, executes tools, then makes a second AI call. With the massive context (18 parallel DB queries), this double-call pattern can exceed the edge function timeout.

3. **Missing `/website` in page map** -- The `pageMap.ts` file has no entry for `/website`, so the AI gets no page-aware context.

## Changes

### 1. Add `admin-chat` to `supabase/config.toml`
Add `verify_jwt = false` entry so the function handles its own auth (which it already does in code).

### 2. Add `/website` to `supabase/functions/_shared/pageMap.ts`
Add entry:
```
"/website": { name: "Website Manager", description: "AI-powered WordPress/WooCommerce editor for rebar.shop — edit posts, pages, products, SEO, redirects" }
```

### 3. Add error logging to `admin-chat/index.ts`
Add `console.error` before the "No response" fallback path so future issues are visible in logs. Also add a timeout guard on the AI gateway fetch calls to prevent silent hangs.

### 4. Improve SSE error handling in `useAdminChat.ts`
When the fetch response is not OK or the stream produces no content, show a more descriptive error instead of "No response from AI" -- e.g., surface the HTTP status or error body so we can debug faster.

## Technical Details

- **File: `supabase/config.toml`** -- Add `[functions.admin-chat]` section with `verify_jwt = false`
- **File: `supabase/functions/_shared/pageMap.ts`** -- Add `/website` entry to PAGE_MAP
- **File: `supabase/functions/admin-chat/index.ts`** -- Add AbortController with 55-second timeout on AI gateway calls to fail gracefully instead of hanging
- **File: `src/hooks/useAdminChat.ts`** -- Change the fallback "No response from AI." message to include more diagnostic info (e.g., "No response from AI. The request may have timed out.")

## Expected Outcome
After these changes, the Website Editor chat will properly authenticate, respond to all messages including tool-based ones like "fix", and provide better error messages if something does go wrong.
