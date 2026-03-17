

# Fix Plan: 6 Remaining Issues in REBAR SHOP OS

## 1. Inbox Garbled Characters (UTF-8 Encoding)

**Root cause:** The `decodeBase64Url` function in `supabase/functions/gmail-sync/index.ts` (line 180-192) has a fallback `atob(base64)` that doesn't handle UTF-8 multi-byte characters. Characters like `•`, `…`, `'` get mangled into `Ã¢â‚¬Â¢` etc. Additionally, `body_preview` (line 412-414) is derived from `msg.body` after stripping HTML tags but doesn't run through `decodeHtmlEntities`.

**Fix:**
- Update `decodeBase64Url` fallback to use `TextDecoder` for proper UTF-8: convert `atob` output to `Uint8Array` then decode with `new TextDecoder("utf-8")`
- Apply `decodeHtmlEntities()` to the `body_preview` value (line 412-414) after stripping HTML tags
- Also run a one-time cleanup query on existing `body_preview` data that contains garbled characters (optional, will be fixed on next sync)

**File:** `supabase/functions/gmail-sync/index.ts`

## 2. SMS Templates "New Template" Button Redirect

**Root cause:** The `SMSTemplateManager` component uses a `Dialog` with `DialogTrigger` wrapping the "New Template" button. The `open`/`onOpenChange` props are passed from `InboxView` via controlled state (`showSMSTemplates`). However, `setShowSMSTemplates(true)` is **never called anywhere** in the codebase — the trigger button inside `SMSTemplateManager` works standalone, but when used as a controlled component with `open={false}`, the `DialogTrigger` click may not properly open the dialog because the controlled `open` prop overrides it.

**Fix:**
- In `SMSTemplateManager`, when `DialogTrigger` is clicked while in controlled mode, ensure `setOpen(true)` is called. The issue is that `DialogTrigger` sets the internal state but the controlled `open` prop takes precedence. Add an explicit `onClick` to the trigger button that calls `setOpen(true)`.

**File:** `src/components/inbox/SMSTemplateManager.tsx` — Add `onClick={() => setOpen(true)}` to the "New Template" Button inside DialogTrigger.

## 3. Customers "0 customers" Flash — Already Fixed

This was addressed in the previous round (loading state added to `src/pages/Customers.tsx`). No further changes needed.

## 4. Chat Back Arrow Not Working

**Root cause:** The `LiveChat.tsx` page at line 236 uses `navigate(-1)` which should work. However, if the user navigated directly to `/chat` (e.g., via the Vizzy floating button), there's no history entry to go back to, so `navigate(-1)` does nothing.

**Fix:**
- Update the back arrow in `LiveChat.tsx` to use `navigate(-1)` with a fallback: check if there's history to go back to, otherwise navigate to `/home`.

**File:** `src/pages/LiveChat.tsx` — Change `onClick={() => navigate(-1)}` to `onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/home")}`

## 5. Pipeline Sync Interval — Already Fixed

The previous round already added a prominent manual Sync button (visible on line 741-751). There is no automatic cron job for Odoo CRM sync (only `archive-odoo-files` runs on cron). The sync is manual-only. The "9 hours" the user sees is simply how long since someone last clicked Sync. No further changes needed — the manual button is already there.

## 6. Sidebar Collapse Persistence — Already Fixed

The previous round added `localStorage`-based pin/collapse persistence with `sidebar_pinned` key. The sidebar now has a Pin toggle button at the bottom. No further changes needed.

---

## Summary of New Changes Needed

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | Garbled characters | `supabase/functions/gmail-sync/index.ts` | **Needs fix** |
| 2 | SMS Template button | `src/components/inbox/SMSTemplateManager.tsx` | **Needs fix** |
| 3 | Customers loading | `src/pages/Customers.tsx` | Already fixed |
| 4 | Chat back arrow | `src/pages/LiveChat.tsx` | **Needs fix** |
| 5 | Pipeline sync | `src/pages/Pipeline.tsx` | Already fixed |
| 6 | Sidebar collapse | `src/components/layout/AppSidebar.tsx` | Already fixed |

Three files need changes. The gmail-sync edge function will be redeployed after the fix.

