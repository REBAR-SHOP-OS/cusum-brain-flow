

## Enhance Multi-Language Support and Humanized English Output

### Changes

**1. `src/components/office/TranscribeView.tsx`**
- Add Georgian (`ka`, "Georgian") to the `LANGUAGES` array (after Hindi)

**2. `supabase/functions/transcribe-translate/index.ts`**
- Update `TRANSLATOR_PERSONA` to explicitly list primary supported languages: English, Farsi, Hindi, Georgian, Arabic, Turkish, Urdu
- Expand code-switching examples to include Hindi+English, Georgian+English, Farsi+Hindi mixes
- Add a COMPREHENSION section instructing the model to first fully understand meaning/intent/cultural context before translating
- Update `buildAudioSystemPrompt` to list all primary languages in the mixing examples (not just "Farsi and English")
- Strengthen humanization: add rules about understanding colloquialisms, slang, and cultural idioms specific to Farsi, Hindi, and Georgian before producing polished English

### Technical Notes
- No backend API or schema changes -- only prompt engineering and one UI addition
- Georgian script is already handled by Gemini; adding it to the picker and prompts improves accuracy
- The two-pass pipeline ensures Pass 2 refines whatever Pass 1 produces, so better Pass 1 prompts directly improve final output quality
