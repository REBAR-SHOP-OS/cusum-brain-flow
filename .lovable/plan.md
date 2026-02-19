
# Investigation Result: Attachment Field on /tasks Create Form

## Current State — Complete Analysis

### File: `src/pages/Tasks.tsx`

The task **creation dialog** (lines 786–857) already contains an attachment upload field. It is rendered at lines 830–851:

```tsx
{isInternal && (
  <div>
    <Label className="text-xs">Attachments</Label>
    <label className="mt-1 flex items-center gap-2 cursor-pointer ...">
      <Paperclip className="w-3.5 h-3.5 shrink-0" />
      {pendingFiles.length > 0 ? `${pendingFiles.length} file(s) selected` : "Click to attach files"}
      <input type="file" multiple className="sr-only" onChange={handleFilePick} />
    </label>
    {/* File list with remove buttons */}
  </div>
)}
```

The task **detail/edit drawer** (lines 1165–1199) also has an "Attachments" section with an upload button and delete per-file — also gated to `isInternal`.

### Root Cause of "Missing" Field

The attachment field is **conditional**: `{isInternal && (` where:

```ts
const isInternal = (currentUserEmail ?? "").endsWith("@rebar.shop");
```

This means any user whose email does NOT end with `@rebar.shop` sees **no attachment field** in either the create dialog or the detail drawer. Per the project memory:

> "Attachments are restricted to @rebar.shop users."

So if the user reporting the bug is testing with a non-@rebar.shop account, the field will always be absent by design.

However, there is a **real bug**: `currentUserEmail` is populated asynchronously (via `supabase.auth.getUser()` in a `useEffect`). If the create dialog is opened immediately on page load — before the auth effect fires — `currentUserEmail` is still `null`, so `isInternal` is `false` and the attachment field is hidden even for `@rebar.shop` users until they close and reopen the dialog.

---

## The Fix — One File Only: `src/pages/Tasks.tsx`

### Problem
`isInternal` relies on `currentUserEmail` which may be `null` at dialog open time because it's set asynchronously. This causes a race condition where internal users temporarily (or permanently, if they open the dialog fast) do not see the attachment field.

### Solution
Derive `isInternal` from the synchronously-available `currentUserId` path, OR ensure the dialog re-renders when `currentUserEmail` is resolved. The simplest surgical fix: initialize `currentUserEmail` from `localStorage`/session cache before the async fetch, or simply force-recompute when the dialog opens.

The cleanest single-line fix: change the `isInternal` derivation so it defaults to showing the field while the email is loading (i.e., treat `null` state as "pending" and show the field optimistically for internal-looking contexts), OR add a dedicated `isLoadingAuth` guard that delays the dialog content until the email is resolved.

**Concrete change — lines 220 and the dialog conditional:**

**Before (line 220):**
```ts
const isInternal = (currentUserEmail ?? "").endsWith("@rebar.shop");
```

**After:**
```ts
// Show attachment field as soon as email resolves; treat null as "loading"
const isInternal = currentUserEmail !== null && currentUserEmail.endsWith("@rebar.shop");
const authResolved = currentUserEmail !== null;
```

**Before (line 830 — create dialog):**
```tsx
{isInternal && (
  <div>
    <Label className="text-xs">Attachments</Label>
    ...
  </div>
)}
```

**After:**
```tsx
{authResolved && isInternal && (
  <div>
    <Label className="text-xs">Attachments</Label>
    ...
  </div>
)}
```

This prevents the field from flashing in/out and ensures it only renders once the auth state is confirmed. Non-internal users still never see it.

---

## Scope

| File | Lines | Change |
|---|---|---|
| `src/pages/Tasks.tsx` | 220 | Add `authResolved` flag alongside `isInternal` |
| `src/pages/Tasks.tsx` | 830 | Guard attachment block with `authResolved && isInternal` |
| `src/pages/Tasks.tsx` | 1169 | Guard drawer upload button with `authResolved && isInternal` |
| `src/pages/Tasks.tsx` | 1184 | Guard drawer delete button with `authResolved && isInternal` |

## What Is NOT Changed
- No other component, page, database table, or RLS policy is touched
- The upload logic, storage bucket, signed URL generation — all untouched
- The `isInternal` restriction rule (attachments only for @rebar.shop) is preserved
- No UI structure changes outside the four conditional guards above
