
# Full API & Connection Audit — Findings & Fix Plan

## Executive Summary

The audit covered: 130+ edge functions, the team chat send pipeline, RLS policies on chat tables, notification/translation chain, the `tasks` table schema, and live edge function + DB logs.

No catastrophic failures were found in the live logs. All recent edge function calls (system-backup) returned HTTP 200. DB error logs show zero ERROR/FATAL entries. Auth is healthy. However, **4 concrete bugs** were identified that explain intermittent send failures, silent notification breakdowns, and a ghost "Radin Lachini & Ryle Lachini" DM that can never receive messages.

---

## Finding 1 — CRITICAL: `translate-message` Requires Auth, But `notifyTranslate.ts` Calls It With Anon Key

**Severity**: High — Silent failure for all non-English notification translations

**Root Cause**:
- `supabase/functions/translate-message/index.ts` uses `requireAuth(req)` which validates the `Authorization` header as a real user JWT via `getClaims()`.
- `supabase/functions/_shared/notifyTranslate.ts` (line 41-46) calls `translate-message` using the raw **anon key** as the Bearer token — not a user JWT.
- `requireAuth` will reject an anon key with `401 Invalid token`.
- The call is wrapped in `try/catch` that silently falls back to English, so **Farsi-speaking users (Kourosh, Radin, Tariq) receive English notifications** instead of their preferred language — and the error is swallowed.

**Fix**: Modify `notifyTranslate.ts` to call `translate-message` using the **service role key** as the Bearer token, and update `translate-message` to accept service role bypass (i.e., allow `SUPABASE_SERVICE_ROLE_KEY` as a valid pass-through, like other internal server-to-server calls). Alternatively — and simpler — move the translation logic inline into `notifyTranslate.ts` using `callAI()` directly (no HTTP round-trip required), removing the dependency on the auth-gated function entirely.

**Files to change**:
- `supabase/functions/_shared/notifyTranslate.ts` — call `callAI()` directly instead of HTTP-invoking `translate-message`

---

## Finding 2 — MEDIUM: Ghost DM Channel "Radin Lachini & Ryle Lachini" Has Only 1 Member

**Severity**: Medium — Any attempt to send to this channel will fail at the RLS `INSERT` policy

**Root Cause**:
- Channel `c7b5a340` ("Radin Lachini & Ryle Lachini") has `member_count: 1` (only Radin) because Ryle Lachini's profile was deleted/deactivated (`user_id: null`, `is_active: false`).
- The `team_messages` INSERT RLS policy requires `is_channel_member(auth.uid(), channel_id)`. Sending requires `sender_profile_id = (SELECT profiles.id FROM profiles WHERE user_id = auth.uid())`.
- Radin is still a member, so she *can* send. But the channel shows 1 recipient, and notifications will fire with 0 members to notify.
- **The real risk**: the channel is still visible in the UI and users expect it to work. When clicked, it will appear to send but the other party (Ryle) no longer has an account.

**Fix**: Add a UI guard in `DockChatBox.tsx` / channel listing to hide or mark channels as "Inactive" when the DM partner has `is_active: false` or `user_id: null`.

---

## Finding 3 — MEDIUM: `notify-on-message` Calls `translate-message` Without Auth (Same Root as Finding 1)

**Severity**: Medium — Push notifications for non-English users never get translated

**Root Cause**:
- `notify-on-message/index.ts` (line 99) calls `translateNotification()` from `notifyTranslate.ts` which in turn calls `translate-message` with the anon key (as identified in Finding 1).
- This means push notifications sent to Kourosh (Farsi) and Tariq (Farsi) arrive in English.

**Fix**: Resolved by the same fix as Finding 1.

---

## Finding 4 — LOW: `DockChatBox.tsx` — `headerProfile` Logic Is Incorrect for Group DMs

**Severity**: Low — Wrong avatar/name can show in the DM header

**Root Cause**:
- Line 235 in `DockChatBox.tsx`:
```typescript
const other = profiles.find((p) => p.id !== myProfile?.id && p.is_active);
```
This searches ALL profiles in the system for any active profile that isn't the current user — not just members of the current channel. In a DM with 2 members, this will accidentally return the first alphabetically active profile it finds if channel membership data hasn't populated yet.

**Fix**: Narrow `profiles` to only members of the current channel. Since `messages` already carry `sender_profile_id`, derive the other-person's profile from the channel members list instead.

---

## No Issues Found (Confirmed Healthy)

| System | Status |
|---|---|
| Auth (JWT / Google OAuth) | ✅ Healthy — 200 on all /auth/v1/user calls |
| `system-backup` edge function | ✅ Healthy — 200, avg 900ms |
| `team_channels` RLS (SELECT) | ✅ Correct — members + admins |
| `team_messages` RLS (INSERT) | ✅ Correct — membership + profile match |
| `team_channel_members` RLS | ✅ Correct — 4 policies all consistent |
| `tasks` table schema | ✅ Has `assigned_to` + `created_by_profile_id` — matches last fix |
| DB error logs | ✅ Zero ERROR/FATAL/PANIC entries |
| Edge function 4xx/5xx logs | ✅ Zero failing HTTP calls in recent window |

---

## Implementation Plan

### Change 1 — Fix `notifyTranslate.ts` (Fixes Findings 1 & 3)

Replace the HTTP call to `translate-message` with a direct inline `callAI()` call to Gemini. This eliminates the auth dependency entirely since `callAI` uses the service-side AI router.

```typescript
// supabase/functions/_shared/notifyTranslate.ts
import { callAI } from "./aiRouter.ts";

export async function translateNotification(...): Promise<{ title: string; body: string }> {
  if (targetLang === "en") return { title, body };
  try {
    const combined = title + "\n" + body;
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: `Translate into ${targetLang}. Return ONLY translated text, same line structure.` },
        { role: "user", content: combined },
      ],
      temperature: 0.1,
    });
    const parts = result.content.split("\n");
    return { title: parts[0]?.trim() || title, body: parts.slice(1).join("\n").trim() || body };
  } catch {
    return { title, body };
  }
}
```

### Change 2 — Hide Inactive DM Channels (Fix Finding 2)

In the channel listing component, filter out or visually mark DM channels where the other member has `is_active: false`.

### Change 3 — Fix `DockChatBox` Header Profile (Fix Finding 4)

Derive the DM partner's profile from the channel members data (already in `useTeamMessages`) rather than scanning all profiles globally.

## Files Modified

- `supabase/functions/_shared/notifyTranslate.ts` — inline AI call, remove HTTP chain
- `src/components/chat/DockChatBox.tsx` — fix headerProfile resolution
- Channel listing component — hide/mark inactive DM channels

