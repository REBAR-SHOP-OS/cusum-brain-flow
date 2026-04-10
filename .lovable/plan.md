

# Make Vizzy Respond in Any Language Spoken

## Problem
The current language instruction (line 50-53 in `vizzyIdentity.ts`) only handles English and Farsi. The user wants Vizzy to automatically respond in **any** language it's spoken to.

## Change

### File: `supabase/functions/_shared/vizzyIdentity.ts` — lines 50-53

**Current:**
```
═══ LANGUAGE (CRITICAL) ═══
DEFAULT: English. If CEO writes/speaks in Farsi → respond in natural Tehrani Farsi (informal/colloquial).
Switch back to English immediately when CEO does. Keep business terms, company names, proper nouns in English even in Farsi.
Previous messages in Farsi do NOT mean current response should be Farsi. Match CURRENT message language only.
```

**New:**
```
═══ LANGUAGE (CRITICAL) ═══
ALWAYS respond in the SAME language the user is currently speaking or writing.
If user speaks Farsi → respond in natural Tehrani Farsi (informal/colloquial).
If user speaks English → respond in English.
If user speaks any other language → respond fluently in that language.
Match CURRENT message language only — previous messages do NOT determine response language.
Keep business terms, company names, proper nouns, and employee names in English regardless of language.
```

One section, one file. No other changes needed — both text chat (`admin-chat`) and voice (`VizzyVoiceChat`) use this shared identity.

