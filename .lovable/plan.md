

# Rename AZIN to Nila + Wake-Word Activation

## Changes

### 1. Rename all "AZIN" references to "Nila"
Update display names across all files (keep file/folder names as-is for minimal churn):
- `agentConfigs.ts` — name: "Nila", greeting updated
- `Home.tsx` — card name "Nila"
- `AzinInterpreter.tsx` — header "Nila — Real-Time Interpreter", alt texts, aria-labels
- `AzinInterpreterVoiceChat.tsx` — "Connecting to Nila...", alt text
- `AzinVoiceChatButton.tsx` — aria-label
- `useAzinVoiceInterpreter.ts` — comment only (no user-facing text)

### 2. Wake-word detection: "Hey Nila"
When the text mic (EN or FA) is active and the user says "Hey Nila", automatically open the voice interpreter overlay.

**Implementation in `AzinInterpreter.tsx`:**
- Add a `useEffect` that watches `committedTranscripts` and `partialText`
- Check if the latest text contains "hey nila" (case-insensitive)
- If detected: disconnect the text mic, open `showVoiceChat`, and remove the wake-word transcript from the list
- Also check `partialText` for faster activation (don't wait for commit)

```text
User speaks into EN/FA mic
  → ElevenLabs transcribes "... hey Nila ..."
  → useEffect detects wake phrase
  → disconnect text mic
  → setShowVoiceChat(true)  (opens avatar voice interpreter)
```

### Files to Edit
- `src/components/agent/agentConfigs.ts` — name change
- `src/pages/Home.tsx` — name change
- `src/pages/AzinInterpreter.tsx` — name change + wake-word logic
- `src/components/azin/AzinInterpreterVoiceChat.tsx` — name change
- `src/components/azin/AzinVoiceChatButton.tsx` — name change

