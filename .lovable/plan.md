

# Fix Double AI Voice + Delay + Missing Invoice Details

## Problems

1. **Double AI greeting**: The ElevenLabs agent (configured as Vizzy in the dashboard) fires its default "Hey Sattar, Vizzy here" greeting immediately. Then the override prompt kicks in and Penny also greets. The caller hears TWO different AI voices/personalities.

2. **Response delay**: The audio processor uses a 4096-sample buffer at 16kHz, which means ~256ms of latency per chunk before audio even reaches ElevenLabs. Combined with WebSocket round-trip, this creates noticeable lag.

3. **AI doesn't know invoice details**: The prompt says "Request payment for outstanding invoices" but never includes the actual invoice numbers, amounts, or customer names. The AI has to say "I don't have access to specific invoice details."

## Solution

### 1. Eliminate double AI by using a dedicated phone agent

Since there's no `ELEVENLABS_PHONE_AGENT_ID` secret set, the system falls back to the default Vizzy agent -- which has its own first_message configured in the ElevenLabs dashboard. The override arrives on the same WebSocket but the default greeting may already be queued.

**Fix**: Create a new secret `ELEVENLABS_PHONE_AGENT_ID` pointing to an ElevenLabs agent configured with:
- No default first_message (empty/blank)
- Minimal default prompt (will be overridden per call)
- Overrides enabled in the agent settings

Alternatively, if creating a second agent isn't feasible right now, we can work around this by ensuring the `conversation_initiation_client_data` message is sent synchronously before any other processing. However, the most reliable fix is a dedicated phone agent with overrides enabled and no default greeting.

### 2. Reduce audio latency

- Decrease the `ScriptProcessor` buffer from 4096 to 2048 samples (halves chunk latency from ~256ms to ~128ms)
- This is the simplest change to reduce perceived delay

### 3. Include invoice details in the AI prompt

Update `buildPhoneCallOverrides` to accept an optional `details` field in `CallBridgeData`. The accounting agent already has invoice data in its context -- we just need to pass it through the call chain so the AI knows exactly which invoices to discuss.

Update the `PennyCallCard` reason field and `CallBridgeData` to carry structured invoice info into the prompt.

## File Changes

### `src/hooks/useCallAiBridge.ts`
- Reduce ScriptProcessor buffer size from 4096 to 2048
- Update `CallBridgeData` interface to include optional `details` string
- Update `buildPhoneCallOverrides` to include invoice details in the prompt so the AI can reference specific amounts and invoice numbers

### `src/components/accounting/PennyCallCard.tsx`
- No changes needed -- the reason field already carries the invoice context from the AI agent response

### Secret: `ELEVENLABS_PHONE_AGENT_ID`
- You will need to create a new ElevenLabs Conversational AI agent specifically for outbound phone calls:
  - Set first_message to empty/blank
  - Enable conversation overrides in the agent settings
  - Use a professional voice (e.g., "Sarah" or "Laura")
  - Keep the default prompt minimal -- it will be overridden per call
- Then add the new agent's ID as a secret

## Expected Result
1. Only ONE AI voice speaks (Penny, with proper introduction)
2. Faster response time (~128ms chunks instead of ~256ms)
3. AI knows exact invoice details: "I'm calling about Invoice 2155 for $1.00 and Invoice 2079 for $4,570.85..."
