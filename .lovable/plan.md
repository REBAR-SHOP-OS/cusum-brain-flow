

# Ensure AI Responses and Notifications Respect User's Preferred Language

## Problem
1. The AI agent (`ai-agent` edge function) always responds in English -- it never checks the user's `preferred_language` from their profile.
2. Several database triggers insert notifications with hardcoded English text (leave requests, order status changes, task assignments, quote requests).

## Changes

### 1. AI Agent -- Respond in User's Preferred Language

**File:** `supabase/functions/ai-agent/index.ts`

- **Line 4744**: Add `preferred_language` to the profile SELECT query:
  ```
  .select("full_name, email, company_id, preferred_language")
  ```
- **Line 5003**: Append a language instruction to the system prompt:
  ```
  ## Response Language
  The user's preferred language is: {userLang}
  You MUST respond in {userLang}. All explanations, summaries, greetings, and responses must be in this language.
  Exception: Technical terms, code, table headers, and proper nouns can remain in English.
  ```

This single change means every AI agent (Vizzy, Blitz, Penny, Forge, etc.) will automatically respond in the user's preferred language.

### 2. DB Trigger Notifications -- Translate via Edge Function

The following DB trigger functions insert English-only notification text. Each will be updated to call the `translate-message` edge function via `net.http_post` before inserting.

However, DB triggers calling edge functions adds latency and complexity. A better approach: **create a new DB trigger on the `notifications` table** that auto-translates notification title/description after insert, based on the recipient's `preferred_language`.

**New edge function:** `translate-notification` (or reuse existing `notify-on-message` pattern)
- Triggered by a new DB trigger `on INSERT into notifications`
- Fetches the recipient's `preferred_language` from profiles
- If not "en", calls `translate-message` to translate title + description
- Updates the notification row with translated text

**Affected DB triggers (no changes needed to them):**
- `notify_leave_request` -- leave approvals/denials
- `notify_human_task` -- AI-created tasks
- `notify_order_status_change` -- order status updates
- `notify_quote_request_push` -- new quote requests

### Summary of Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Add `preferred_language` to profile query; add language instruction to system prompt |
| `supabase/functions/translate-notification/index.ts` | New edge function: auto-translate notifications for non-English users |
| Database migration | New trigger on `notifications` table to call `translate-notification` on INSERT |

### What Does NOT Change
- `translate-message` edge function (already works)
- `notifyTranslate.ts` shared utility (already works)
- `notify-on-message` (already translates)
- `notify-feedback-owner` (already translates)
- Any frontend/UI code (stays English as per your preference)
- Profile `preferred_language` field (already exists and is settable)

