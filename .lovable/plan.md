

# Flex Auth & ParseBody Support for `handleRequest`

## Problem
`handleRequest` always calls `requireAuth()` which throws 401 on missing tokens. This blocks:
- `admin-chat`: needs unauthenticated publicMode + authenticated admin mode
- FormData endpoints: body gets consumed by `req.json()` before handler can call `req.formData()`

`ad-director-ai` and `ai-agent` are already migrated and working — they just need a compatibility re-check.

## Changes

### 1. Update `RequestContext` interface
Add nullable fields for optional auth:

```text
RequestContext {
  req: Request;
  userId: string;          // "" when authMode is "none" or unauthenticated optional
  companyId: string;       // "" when not resolved
  serviceClient: ...;      // always available
  userClient: ... | null;  // null when no auth token
  body: Record<string, any>;
  log: ...;
}
```

### 2. Add `authMode` to `HandlerOptions`

```typescript
authMode?: "required" | "optional" | "none"; // default "required"
```

- `"required"` — current behavior (calls `requireAuth`, throws 401)
- `"optional"` — calls `optionalAuth` from `auth.ts`; sets `userId` if token valid, `""` if not; never throws
- `"none"` — skips auth entirely, creates only `serviceClient`

### 3. Update `handleRequest` auth block

```text
if authMode === "none":
  → serviceClient only, userId = "", userClient = null
if authMode === "optional":
  → try optionalAuth(); if userId found, build userClient; otherwise null
  → skip company resolution and role checks when userId is empty
if authMode === "required" (default):
  → current requireAuth() behavior unchanged
```

### 4. Enhance `optionalAuth` in `auth.ts`
Return full auth context (not just userId) so the wrapper can get `userClient`:

```typescript
export async function optionalAuthFull(req: Request): Promise<{
  userId: string | null;
  userClient: ReturnType<typeof createClient> | null;
} | null>
```

### 5. Re-check `ad-director-ai` and `ai-agent`

Both already use `handleRequest` with `wrapResult: false`. Verify:
- **Response compatibility**: both return `Response` objects or plain objects — wrapper handles both via `instanceof Response` check ✓
- **Auth compatibility**: both use `requireCompany: false` and rely on `requireAuth` — no change needed ✓
- **Error compatibility**: both throw errors caught by wrapper's try/catch — produces `{ ok: false, error }` which matches current behavior ✓

No code changes needed for these two.

### 6. Migrate `admin-chat` with `authMode: "optional"`

The handler receives `ctx` with nullable `userId`. Internal logic:
- If `body.publicMode && !ctx.userId` → public visitor chat path (unchanged logic)
- If `ctx.userId` → admin check + full authenticated path (unchanged logic)
- If `!body.publicMode && !ctx.userId` → return 401

Body parsing: `admin-chat` uses `req.json()` but the wrapper already parses it into `ctx.body`. The function currently reads body once and reuses it — the wrapper does the same thing, so this is compatible.

## Files Changed

| File | Change |
|---|---|
| `_shared/requestHandler.ts` | Add `authMode` option, update auth block to handle 3 modes |
| `_shared/auth.ts` | Add `optionalAuthFull()` returning userId + userClient |
| `admin-chat/index.ts` | Migrate outer shell to `handleRequest` with `authMode: "optional"` |

## What does NOT change
- `ad-director-ai/index.ts` — already compatible, no edits
- `ai-agent/index.ts` — already compatible, no edits
- All existing `handleRequest` consumers — `authMode` defaults to `"required"`
- No business logic changes in any function
- `parseBody: false` already works for FormData endpoints

