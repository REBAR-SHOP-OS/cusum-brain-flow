

# Fix: Clean English-Only Reports Without Markdown Syntax

## Problem
The speaker report modal shows raw markdown (`## Context & Background`, `## Key Discussion Points`, etc.) because the AI prompt instructs it to use `##` headers. The user wants a clean, concise English paragraph — no markdown formatting visible in the modal.

## Solution

Two changes:

### 1. Update summarize prompt (`supabase/functions/transcribe-translate/index.ts`)
Replace the structured `##`-based format with instructions for a clean, concise English paragraph summary. No markdown headers, no bullet markers — just well-written prose covering context, key points, decisions, and conclusions in a compact format.

### 2. Strip residual markdown in the modal (`src/components/office/TranscribeView.tsx`)
Add a simple cleanup function on the displayed text in the report dialog (line 728) to strip any remaining `##`, `**`, or `-` markers as a safety net, in case the AI still returns some markdown.

## Files
- **Edit**: `supabase/functions/transcribe-translate/index.ts` (lines 45-69 — rewrite summarize prompt)
- **Edit**: `src/components/office/TranscribeView.tsx` (line 728 — strip markdown in modal display)

