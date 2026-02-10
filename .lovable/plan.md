
# AI Transcription & Translation Module for Office Tools

## What This Adds

A new **"AI Transcribe"** section inside Office Tools that lets you:

1. **Live Microphone Transcription** -- speak in any language, get real-time English text
2. **Audio File Upload** -- drop an MP3/WAV/M4A file, get it transcribed and translated to English
3. **Text Paste & Translate** -- paste text in any language and get an English translation
4. **Advanced Options** -- source language auto-detect or manual select, tone/formality control, glossary/context hints, copy/download results

Everything is powered by the existing Lovable AI gateway (no extra API keys needed).

---

## New Files

### 1. `src/components/office/TranscribeView.tsx`
The main UI component with three tabs:

- **Mic Tab**: Live microphone transcription using browser SpeechRecognition API with real-time display, auto-detect language, and AI translation to English
- **Upload Tab**: Drag-and-drop or file picker for audio files (sent to a backend function for transcription + translation)
- **Text Tab**: Paste any foreign text, select source language (or auto-detect), get English translation

Advanced options panel (collapsible):
- Source language selector (auto-detect default, 30+ languages)
- Formality level (casual / neutral / formal)
- Context hint text field (e.g., "manufacturing terminology")
- Output format toggle (plain text / bullet points / paragraphs)

Results area:
- Original text display
- English translation display
- Copy to clipboard button
- Download as .txt button
- History of recent transcriptions (session-local)

### 2. `supabase/functions/transcribe-translate/index.ts`
New edge function that handles two modes:

**Mode 1: Text translation**
- Receives `{ mode: "text", text: string, sourceLang?: string, formality?: string, context?: string }`
- Uses Lovable AI (gemini-3-flash-preview) to detect language + translate to English
- Returns `{ original: string, detectedLang: string, english: string }`

**Mode 2: Audio transcription**
- Receives audio file as FormData
- Uses Lovable AI to transcribe audio content and translate to English
- Returns `{ transcript: string, detectedLang: string, english: string }`

Both modes support the advanced options (formality, context hints, output format).

---

## Modified Files

### 3. `src/components/office/OfficeSidebar.tsx`
- Add `"ai-transcribe"` to the `OfficeSection` type union
- Add entry to `officeTools` array: `{ id: "ai-transcribe", label: "AI Transcribe", icon: Languages }`
- Import `Languages` from lucide-react

### 4. `src/pages/OfficePortal.tsx`
- Import `TranscribeView`
- Add `"ai-transcribe": TranscribeView` to the `sectionComponents` map

---

## Technical Details

### TranscribeView Component Structure

```text
TranscribeView
  +-- Tabs: [ Microphone | Upload File | Paste Text ]
  |
  +-- Advanced Options (collapsible)
  |     +-- Source Language (Select, default: Auto-detect)
  |     +-- Formality (Select: casual/neutral/formal)
  |     +-- Context Hint (Input)
  |     +-- Output Format (Toggle: plain/bullets/paragraphs)
  |
  +-- Results Panel
  |     +-- Original text (with detected language badge)
  |     +-- English translation
  |     +-- Action buttons: Copy | Download | Clear
  |
  +-- Session History (accordion, last 10 items)
```

### Microphone Tab Flow

```text
User clicks "Start Listening"
  --> Browser SpeechRecognition starts (lang = selected or auto)
  --> Interim results shown live in "Original" panel
  --> On final result, call transcribe-translate edge function
  --> English translation appears in "English" panel
  --> Entry added to session history
```

### Upload Tab Flow

```text
User drops audio file or clicks file picker
  --> File sent to transcribe-translate edge function (FormData)
  --> Loading spinner shown
  --> Returns transcript + English translation
  --> Both displayed in results panel
```

### Edge Function: `transcribe-translate/index.ts`

- Auth guard via `requireAuth`
- For text mode: AI prompt instructs the model to detect language, translate to English with specified formality/context
- For audio mode: Since Lovable AI supports multimodal (Gemini), encode audio as base64 and send in the prompt for transcription + translation
- Rate limiting not needed initially (auth-gated)

### Supported Languages (auto-detect + manual)
English, Farsi, Spanish, French, Arabic, Hindi, Chinese, German, Portuguese, Russian, Korean, Japanese, Turkish, Urdu, Italian, Dutch, Polish, Vietnamese, Thai, Indonesian, Malay, Filipino, Bengali, Punjabi, Tamil, Telugu, Swahili, Hebrew, Greek, Czech
