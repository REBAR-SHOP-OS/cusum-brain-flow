

# Fix Double AI Voice and Delay

## Root Cause (Confirmed)

Your ElevenLabs phone agent has overrides enabled (confirmed from screenshot) -- but it still has a **default "First message" configured in the Agent tab**. ElevenLabs fires that message instantly on connect, before the override payload arrives. That's why you hear two greetings.

## Required Manual Step (ElevenLabs Dashboard)

1. Open the phone agent (the one whose ID is in `ELEVENLABS_PHONE_AGENT_ID`)
2. Go to the **Agent** tab
3. **Delete the "First message" field** -- leave it completely blank/empty
4. Set the default system prompt to something minimal like: `Follow the override instructions provided at conversation start.`
5. Save

This is the single most important fix. Without it, no code change can prevent the double greeting.

## Code Change

### `src/hooks/useCallAiBridge.ts`

Add a short delay (~300ms) after sending the override before starting the audio processor. This gives ElevenLabs time to register the override prompt and first_message before any audio triggers a response:

```
ws.onopen = () => {
  // Send override FIRST
  if (overrides) {
    ws.send(JSON.stringify({
      type: "conversation_initiation_client_data",
      conversation_config_override: overrides,
    }));
  }

  // Wait briefly for override to register, then start audio
  setTimeout(() => {
    processor.onaudioprocess = (e) => { ... };
    replaceOutgoingTrack(pc, aiDest.stream);
    setState(...);
  }, 300);
};
```

This ensures the AI doesn't start hearing caller audio and responding with default behavior before the Penny persona is loaded.

## Expected Result

- Only ONE AI voice speaks (Penny with proper greeting)
- Reduced delay from buffer optimization (already applied) plus override timing fix
