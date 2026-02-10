
# Speaker Diarization & Intelligent Name Detection

## Overview

Add speaker diarization (Speaker 1, Speaker 2, etc.) to the transcription system, with intelligent name detection -- if speakers mention each other's names during the conversation, automatically replace "Speaker 1" / "Speaker 2" with their actual names.

## Backend Changes (`supabase/functions/transcribe-translate/index.ts`)

### 1. Update AI Prompts for Speaker Diarization

Update both audio and text mode prompts to instruct the AI to:
- Identify distinct speakers by voice characteristics (tone, pitch, accent)
- Label them initially as "Speaker 1", "Speaker 2", etc.
- Listen for name mentions (e.g. "Hey Ali", "Thanks John", "Mr. Smith said...")
- Replace speaker labels with detected names when found
- Output the transcript with speaker labels on each line

### 2. New JSON Response Format

Change the response structure to include speaker-labeled transcript:

```text
{
  "transcript": "Ali: سلام، how are you?\nJohn: I'm good, Ali. Let's talk about the project.",
  "detectedLang": "Farsi/English mix",
  "english": "Ali: Hello, how are you?\nJohn: I'm good, Ali. Let's talk about the project.",
  "speakers": ["Ali", "John"],
  "confidence": 92
}
```

If names cannot be detected, fall back to "Speaker 1", "Speaker 2".

### 3. Update Pass 2 (Verification)

The reviewer pass will also verify:
- Speaker attribution consistency (same voice = same label throughout)
- Name detection accuracy
- Correct assignment of dialogue to speakers

## Frontend Changes (`src/components/office/TranscribeView.tsx`)

### 1. Speaker-Aware Transcript Display

- Parse the speaker-labeled transcript and render each speaker's lines with distinct styling
- Color-code speakers (e.g., Speaker 1 = blue, Speaker 2 = green)
- Show speaker names as bold labels before their text

### 2. Speakers Badge

- Show detected speaker names/count near the confidence badge
- Example: "2 speakers: Ali, John"

### 3. History Entry Update

- Update `HistoryEntry` interface to optionally include `speakers` array
- Display speaker count in history list

## Technical Details

### Prompt Engineering (Key Addition)

The system prompt will include:

```text
SPEAKER DIARIZATION:
- This audio/text may contain multiple speakers in a conversation.
- Identify each distinct speaker and label them.
- IMPORTANT: Listen carefully for when speakers address each other by name
  (e.g. "Hey Ali", "Thank you Sarah", "Mr. Johnson", etc.)
- If you detect a speaker's name, use their real name instead of "Speaker 1/2".
- If no name is detected for a speaker, use "Speaker 1", "Speaker 2", etc.
- Format each line as: "SpeakerName: their words here"
- Maintain consistent speaker labels throughout the entire transcript.
- Include a "speakers" array in your response listing all identified speakers.
```

### Frontend Rendering

Speaker lines will be parsed by splitting on newlines and detecting the `Name:` pattern, then rendered with colored badges per speaker.

### Files Modified

1. `supabase/functions/transcribe-translate/index.ts` -- Add diarization instructions to prompts, update JSON schema, update Pass 2 review prompt
2. `src/components/office/TranscribeView.tsx` -- Speaker-aware rendering, color-coded display, speakers badge, updated history interface
