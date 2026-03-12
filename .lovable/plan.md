

# Make All Notifications English-Only

## Problem
The screenshot shows a push notification in Persian ("پشتیبانی: بازدید کننده"). The system currently translates notifications into each user's `preferred_language` via two mechanisms:
1. **`translate-notification` edge function** — DB trigger on INSERT that writes `title_local`/`description_local` columns
2. **`notify-on-message` edge function** — translates support messages per-language group before inserting
3. **`useNotifications.ts`** — realtime handler prefers `title_local`/`description_local` over English originals for toasts and browser push

Per the project's language standard, **all UI including notifications must be English only**.

## Changes

### 1. `supabase/functions/translate-notification/index.ts`
Make it a no-op: always return `{ skipped: "translation disabled" }` without calling `translateNotification`. This effectively disables the DB trigger translation.

### 2. `supabase/functions/notify-on-message/index.ts`
In `handleSupportMessage`: remove `groupByLanguage` and `translateNotification` calls. Use English `titleEn`/`preview` directly for all recipients (same as team messages already do).

### 3. `src/hooks/useNotifications.ts`
In the realtime INSERT handler: use `newRow.title` and `newRow.description` directly instead of preferring `title_local`/`description_local`.

### 4. `src/lib/browserNotification.ts`
No changes needed — it just displays what it receives.

## Files Modified
1. `supabase/functions/translate-notification/index.ts` — disable translation
2. `supabase/functions/notify-on-message/index.ts` — remove translation from support messages
3. `src/hooks/useNotifications.ts` — stop using `title_local`/`description_local`

