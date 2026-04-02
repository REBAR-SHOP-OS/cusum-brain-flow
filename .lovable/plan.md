

# Fix Eisenhower Agent Language: Default to English

## Problem
Two issues causing the agent to speak Persian instead of English by default:

1. **Hardcoded Persian welcome message** in `src/pages/AgentWorkspace.tsx` (line 237): `"سلام! 👋\n\nلطفاً ابتدا **تاریخ مورد نظر** را از تقویم بالای صفحه انتخاب کنید 📅"`
2. **Language rules in system prompt** (`supabase/functions/_shared/agents/growth.ts` lines 175-178): Currently says "match the user's language for all non-report messages" — needs to be updated to default to English unless the user writes in another language.

## Changes

### 1. `src/pages/AgentWorkspace.tsx` — line 237
Replace the Persian welcome message with English:
```
"Hello! 👋\n\nPlease select your **target date** from the calendar at the top of the page 📅"
```

### 2. `supabase/functions/_shared/agents/growth.ts` — lines 175-178
Update the language rules to:
- **Default language is English** for all responses
- **If the user writes in another language**, switch to that language for conversational responses
- Final reports always in English (keep existing rule)

Updated rules:
```
## LANGUAGE RULES (CRITICAL):
- **Default language is English.** Always start and respond in English unless the user writes in a different language.
- If the user writes in another language (Persian, Arabic, Spanish, etc.), switch to THAT language for all conversational responses (questions, clarifications, confirmations, encouragement).
- **Final Eisenhower Matrix report**: MUST ALWAYS be written in English, regardless of the conversation language.
- Never refuse or redirect a user for writing in a non-English language.
```

### Files changed
| File | Change |
|------|--------|
| `src/pages/AgentWorkspace.tsx` | Replace Persian welcome message with English |
| `supabase/functions/_shared/agents/growth.ts` | Update language rules to default English |

