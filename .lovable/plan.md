

# Production Readiness Cleanup

## Scope
Surgical removal of debug artifacts and hardening of client-side code for production. No functional changes, no UI changes, no module restructuring.

---

## 1. Remove Debug `console.log` Statements (Client-Side)

The following `console.log` calls are pure debug noise and will be removed:

| File | Line(s) | Content |
|------|---------|---------|
| `src/components/office/ProductionQueueView.tsx` | 147, 149 | `[PQ] fetching customers...`, `[PQ] customers result...` |
| `src/hooks/useTeamMeetings.ts` | 89, 138 | `[Meeting] RingCentral Video bridge created`, `Meeting summarized:` |
| `src/components/error/SmartErrorBoundary.tsx` | 80 | `Auto-recovering in Xms...` |

**Preserved:** All `console.error` and `console.warn` calls remain -- they serve as production diagnostics for real failures. Edge function logs also remain since they only run server-side and are essential for operational monitoring.

---

## 2. Guard `localStorage` Serialization

Files `useGlobalErrorHandler.ts` and `SmartErrorBoundary.tsx` already have try/catch around localStorage. No changes needed -- confirmed safe.

---

## 3. Sanitization Audit (Confirmed Safe)

All 4 `dangerouslySetInnerHTML` usages are properly guarded:

- `InboxEmailThread.tsx` -- DOMPurify with strict ALLOWED_TAGS/FORBID_TAGS
- `InboxEmailViewer.tsx` -- DOMPurify with strict config
- `EmailViewer.tsx` -- DOMPurify with strict config
- `chart.tsx` -- Static theme CSS only, no user input

No changes needed.

---

## 4. Edge Function Log Cleanup (Server-Side)

Remove verbose `console.log` from production edge functions while keeping error logs:

| Function | Lines to Remove |
|----------|----------------|
| `supabase/functions/process-rfq-emails/index.ts` | 6 debug log lines (scanning, found, pre-filtered, matched, created, done) |
| `supabase/functions/generate-video/index.ts` | 3 debug log lines (operation created, job created, generating) |
| `supabase/functions/gmail-send/index.ts` | 1 debug log line (authenticated userId, sending to) -- **security risk: leaks PII** |
| `supabase/functions/pdf-to-images/index.ts` | 4 debug log lines (page counts, sizes, conversions) |
| `supabase/functions/daily-team-report/index.ts` | 1 debug log line |

**Preserved:** All `console.error` calls remain for failure diagnostics.

---

## 5. Summary of Changes

- **~20 `console.log` removals** across 8 files (3 client, 5 edge functions)
- **0 functional changes** -- all behavior preserved
- **0 UI changes**
- **5 edge functions redeployed** after cleanup

### Files Modified
1. `src/components/office/ProductionQueueView.tsx`
2. `src/hooks/useTeamMeetings.ts`
3. `src/components/error/SmartErrorBoundary.tsx`
4. `supabase/functions/process-rfq-emails/index.ts`
5. `supabase/functions/generate-video/index.ts`
6. `supabase/functions/gmail-send/index.ts`
7. `supabase/functions/pdf-to-images/index.ts`
8. `supabase/functions/daily-team-report/index.ts`

