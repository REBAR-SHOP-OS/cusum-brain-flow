

# Plan: Force English Output for All Post-Processing & Improve Report Accuracy

## Problem
When the transcript is in Farsi (or any non-English language), the post-processing outputs (Summarize, Action Items, Meeting Notes, Clean Up, Custom) may return results in the source language instead of English. The summarize prompt also lacks detail, producing shallow reports.

## Changes

### 1. `supabase/functions/transcribe-translate/index.ts` — Update POST_PROCESS_PROMPTS (lines 44-87)

Add explicit **"ALWAYS respond in English"** instruction to every post-process prompt. Also enhance the `summarize` prompt for much higher accuracy and detail:

- **summarize**: Add instruction to always output in English. Expand to require: context/background, key discussion points, decisions, concerns raised, and conclusions. Emphasize precision and thoroughness.
- **action-items**: Add "ALWAYS respond in English regardless of transcript language."
- **meeting-notes**: Add "ALWAYS respond in English regardless of transcript language."
- **cleanup**: Add "ALWAYS translate to English while cleaning up. Output must be in English."
- **custom** (line 191): Add "IMPORTANT: Always respond in English." to the system prompt.

### 2. Same file — Enhance summarize prompt specifically

Replace the current 2-line summarize prompt with a detailed one:

```
You are an expert analyst and report writer. Given the following transcript, produce a comprehensive, highly accurate summary IN ENGLISH.

Structure:
## Context & Background
- What is this conversation about? Who are the participants?

## Key Discussion Points
- Each major topic discussed, with specific details and quotes where relevant

## Decisions & Agreements
- Any decisions made or agreements reached

## Concerns & Issues Raised
- Problems, objections, or risks mentioned

## Conclusions
- Final outcomes and next steps

CRITICAL RULES:
- ALWAYS write in English, regardless of the transcript language
- Be extremely precise — do not generalize or omit important details
- Include specific names, numbers, dates, and facts mentioned
- Do not add information that was not in the transcript
- Respond with the summary text only, no JSON wrapper.
```

This ensures all outputs are always English and the summary/report is thorough and accurate.

