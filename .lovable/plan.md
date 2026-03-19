

# Rewrite Event Descriptions: Pure Historical/Cultural Only

## Problem
Both English `description` fields in `contentStrategyData.ts` and Persian `details` in `ContentStrategyPanel.tsx` mix historical context with business/company suggestions (e.g., "For construction companies, this is a chance to..."). The user wants **only** historical/cultural information — no business advice.

## Changes

### 1. `src/components/social/contentStrategyData.ts` — All 26 event descriptions
Rewrite every `description` field to be purely historical/cultural:
- What the day/event is
- Its origin and history
- Why it's significant culturally
- **Remove** all "For construction...", "Showcase your...", "Promote...", "Highlight your..." business advice

Example (Nowruz — currently ends with business advice):
- **Before**: "...Nowruz aligns perfectly with the spring construction season — symbolizing fresh starts, new projects, and building for the future."
- **After**: Remove that last sentence entirely. Keep the UNESCO, 300 million people, Haft-sin, Chaharshanbe Suri content.

### 2. `src/components/social/ContentStrategyPanel.tsx` — All 26 Persian `details`
Same treatment for all Persian descriptions:
- Keep historical/cultural facts
- **Remove** all business suggestions like "برای صنعت ما...", "فرصتی برای تبلیغ...", "برای شرکت‌های ساختمانی..."

### 3. `supabase/functions/_shared/eventCalendar.ts` — Backend mirror
This file has no `description` field, only `contentTheme` — no changes needed (contentTheme is used for AI prompt context, not user-facing).

## Scope
- ~26 English descriptions rewritten
- ~26 Persian details rewritten
- No structural/code changes, only string content

