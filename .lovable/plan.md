
# Make Vizzy Multi-Language with Native Tehrani Farsi

## What This Does
Vizzy will automatically detect when you speak Farsi and respond in natural, colloquial Tehrani Farsi -- like talking to a sharp, savvy assistant from Tehran. The chat UI will also properly handle right-to-left (RTL) text so Farsi messages display correctly.

---

## Changes

### 1. Upgrade System Prompts (Both Edge Functions)

**`supabase/functions/admin-chat/index.ts`** -- Replace the minimal multilingual line with rich Farsi instructions (matching what voice Vizzy already has):

- Detect user language and respond in the same language
- When user speaks Farsi, use colloquial Tehrani dialect (e.g. "چطوری" not "حالتان چطور است")
- Support seamless code-switching between English and Farsi mid-conversation
- If user mixes Farsi and English (Finglish), match their style
- Never translate business terms unnecessarily -- keep proper nouns, company names, and technical terms in English
- Use Persian numerals optionally when fully in Farsi context

**`supabase/functions/vizzy-daily-brief/index.ts`** -- Add language awareness to the briefing prompt so if the user's last interaction was in Farsi, the briefing responds in Farsi too.

### 2. RTL Support in Chat UI

**`src/components/chat/RichMarkdown.tsx`** -- Add automatic RTL detection:
- Detect if the message content starts with Farsi/Arabic Unicode characters
- If so, apply `dir="rtl"` and appropriate text alignment to the container
- This ensures Farsi text flows naturally right-to-left

**`src/pages/LiveChat.tsx`** (or message bubble component) -- Add per-message RTL detection so each bubble aligns correctly based on its language.

### 3. Voice Vizzy (Already Done)
The voice context in `src/lib/vizzyContext.ts` already has excellent Tehrani Farsi instructions -- no changes needed there.

---

## Technical Details

### System Prompt Addition (admin-chat)
Add this block to the system prompt in `admin-chat/index.ts`:

```text
═══ LANGUAGE ═══
You are MULTILINGUAL. You MUST respond in whatever language the CEO speaks to you.
If the CEO speaks Farsi (Persian), respond in Farsi with a natural Tehrani accent and conversational tone -- like a native Tehran speaker.
Use informal/colloquial Farsi when appropriate (e.g. "چطوری" not "حالتان چطور است", "الان" not "اکنون", "میخوای" not "می‌خواهید").
You can seamlessly switch between English and Farsi mid-conversation. If the CEO code-switches (mixes Farsi and English), match their style.
Keep business terms, company names, and proper nouns in English even when responding in Farsi.
When fully in Farsi mode, you may use Persian numerals (۱۲۳) but always keep currency in USD format.
```

### RTL Detection Utility
A simple helper function to detect RTL content:

```text
function isRTL(text: string): boolean {
  // Check first 100 meaningful characters for Farsi/Arabic script
  const cleaned = text.replace(/[#*_`>\-\s\d]/g, '').slice(0, 100);
  const rtlChars = (cleaned.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  return rtlChars > cleaned.length * 0.3;
}
```

### Files to Modify
1. **`supabase/functions/admin-chat/index.ts`** -- Add detailed Farsi language instructions to system prompt
2. **`supabase/functions/vizzy-daily-brief/index.ts`** -- Add multilingual awareness to briefing prompt
3. **`src/components/chat/RichMarkdown.tsx`** -- Add RTL detection and `dir="rtl"` attribute
4. **`src/lib/vizzyContext.ts`** -- Already has Farsi instructions (no changes)
