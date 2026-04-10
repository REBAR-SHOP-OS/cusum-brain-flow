

# Fix Vizzy Voice: Farsi Response + Brain Knowledge Integration

## Problems Identified

1. **Language**: The voice engine's language instructions (line 52 of `useVizzyVoiceEngine.ts`) already say "auto-detect and match language." The browser STT already auto-detects (no `lang` set). But the **ElevenLabs TTS voice** (`EXAVITQu4vr4xnSDxMaL` = "Sarah", English-only) cannot speak Farsi. When Vizzy responds in Farsi text, it gets read aloud in English phonetics — garbled output. Need to detect Farsi responses and switch to a multilingual or Farsi-capable ElevenLabs voice.

2. **Brain Knowledge Missing from Voice**: The `vizzy-pre-digest` edge function (used by voice) loads `vizzy_memory` but does NOT load the `knowledge` table (where company rules, brain files, and custom instructions are stored). The text chat loads this via `vizzy-context` → `brainKnowledge`, but voice sessions never see it. Company rules written in the CompanyRulesDialog are invisible to voice Vizzy.

## Changes

### 1. Load `knowledge` table in `vizzy-pre-digest` (edge function)
**File**: `supabase/functions/vizzy-pre-digest/index.ts`

- After loading `brainMemories` from `vizzy_memory` (~line 84), add a query to `knowledge` table:
  ```sql
  SELECT title, content, category FROM knowledge ORDER BY created_at DESC LIMIT 20
  ```
- Build a `knowledgeBlock` string from results
- Append it to `brainBlock` so it flows into the voice session context
- Include it in the returned `brainMemories` field so the client-side `buildInstructions` injects it

### 2. Detect response language and switch TTS voice
**File**: `src/hooks/useVizzyGeminiVoice.ts` (~line 193-210)

- Before calling ElevenLabs TTS, detect if the response text contains Farsi characters (Unicode range `\u0600-\u06FF`)
- If Farsi detected → use a multilingual ElevenLabs voice ID (e.g., `pFZP5JQG7iQjIQuC4Bku` — "Lily" multilingual, or another that supports Farsi)
- If English → keep current voice `EXAVITQu4vr4xnSDxMaL` ("Sarah")
- This ensures the TTS output matches the language of the response

### 3. Minor: strengthen voice system prompt language instruction
**File**: `src/hooks/useVizzyVoiceEngine.ts` (line 52)

- Already correct but add emphasis: "Your TTS output will be in the same language. Respond FULLY in the detected language including all explanations."

## Scope
- 2 modified files: `useVizzyGeminiVoice.ts`, `vizzy-pre-digest/index.ts`
- 1 minor edit: `useVizzyVoiceEngine.ts` (language instruction reinforcement)
- No database changes

