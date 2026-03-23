

## Fix: Sync Language & Behavioral Rules Across Voice and Text Vizzy

### Problem
Voice Vizzy (line 22) still says "Match her language (English or Farsi) instantly" — no English-default enforcement. Text Vizzy was fixed with a dedicated `═══ LANGUAGE (CRITICAL) ═══` section, but voice never got it. This means voice can still drift to Farsi from context.

### Changes

#### File: `src/hooks/useVizzyVoiceEngine.ts`

**Change 1: Replace weak language line with strong English-default rule**

Replace line 22:
```
- Match her language (English or Farsi) instantly.
```
With a proper LANGUAGE block (after the PERSONALITY section, before INTELLIGENCE STANDARD):
```
═══ LANGUAGE (CRITICAL) ═══
Your DEFAULT language is ENGLISH. Always respond in English unless the CEO explicitly speaks to you in Farsi/Persian.
If the CEO speaks in Farsi, respond in Farsi with a natural Tehrani accent — like a native Tehran speaker.
If the CEO switches back to English, switch back IMMEDIATELY.
Previous messages in Farsi do NOT mean current response should be in Farsi. Match the CURRENT input language only.
Keep business terms, company names, proper nouns, and technical terms in English even when responding in Farsi.
```

**Change 2: Add missing banned phrases to voice** (align with text Vizzy's list)

Add these to the BANNED PHRASES section (currently missing from voice):
- "Just let me know" — BANNED
- "If you need more detail" — BANNED  
- "If there's anything specific you need" — BANNED
- "I can do a deeper investigation" — BANNED. Just DO the deeper investigation.

These were already added to text Vizzy but never synced to voice.

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useVizzyVoiceEngine.ts` | Replace weak language line with English-default LANGUAGE block + add missing banned phrases |

### What This Fixes
- Voice Vizzy will default to English and only switch to Farsi when the CEO explicitly speaks Farsi
- Voice and text Vizzy now have identical language rules and banned phrases

