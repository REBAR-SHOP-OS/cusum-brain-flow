

# Fix AI Voice Bridge: Proper Phone Call Behavior

## Problems Identified

1. **Wrong AI identity**: The ElevenLabs agent is configured as "Vizzy" for voice chat with you (Sattar). When bridged to a phone call, it greets the called party with "Hey Sattar, Vizzy here" -- completely wrong for an outbound call to a customer.

2. **Context arrives too late**: The call context (reason, contact name) is sent as a `contextual_update` after the agent already starts its default greeting. The agent ignores it and follows its pre-configured behavior.

3. **Same agent for everything**: One ElevenLabs agent (`ELEVENLABS_AGENT_ID`) is shared between Vizzy voice chat and phone call bridging. These need different behaviors.

## Solution

### 1. Create a dedicated "Phone Caller" ElevenLabs agent (or override at connection time)

Update the edge function `elevenlabs-conversation-token` to accept an optional `mode` parameter. When `mode === "phone_call"`, use a separate agent ID (`ELEVENLABS_PHONE_AGENT_ID`) or the same agent with **conversation overrides** sent at WebSocket connection time.

### 2. Override prompt and first message per call

When the WebSocket connects, send a `conversation_initiation_client_data` event (ElevenLabs protocol) that overrides:
- **System prompt**: "You are an AI assistant calling on behalf of Rebar Shop. You are calling [contact_name] to [reason]. Be professional, introduce yourself, and handle the conversation."
- **First message**: "Hi, this is an automated call from Rebar Shop. I'm calling regarding [reason]. Is this [contact_name]?"

This way each call gets a unique, contextual introduction.

### 3. Pass agent name and call context from the calling component

The `startBridge` function will accept additional parameters: `agentName` (Penny/Vizzy/Forge) and `callData` (contact_name, reason, phone). These are used to construct the override prompt.

## File Changes

### `supabase/functions/elevenlabs-conversation-token/index.ts`
- Accept an optional `mode` parameter from the request body
- When `mode === "phone_call"`, use `ELEVENLABS_PHONE_AGENT_ID` if set, otherwise fall back to the same agent
- Return the signed URL as before

### `src/hooks/useCallAiBridge.ts`
- Update `startBridge` to accept structured call data (agent name, contact name, reason)
- After WebSocket opens, send `conversation_initiation_client_data` with prompt and first message overrides BEFORE any audio processing starts
- Remove the `contextual_update` approach (too late, agent ignores it)
- The override prompt will instruct the AI: "You are [AgentName] from Rebar Shop. You called [contact_name] at [phone]. Reason: [reason]. Start by introducing yourself and stating the purpose of your call."

### `src/components/accounting/AccountingAgent.tsx`
- Update the `onStartAiBridge` callback to pass the agent name ("Penny") and full call data to `startBridge`

### `src/components/accounting/PennyCallCard.tsx`
- Update `onStartAiBridge` prop type to pass call data through

## Expected Result After Fix

1. User tells Penny "call this customer about invoices"
2. Penny shows the call card, user clicks "Call Now"
3. Call connects, AI bridge auto-activates
4. The called person hears: **"Hi, this is Penny calling from Rebar Shop. I'm reaching out regarding your outstanding invoices..."**
5. The AI has a proper conversation about the specific invoices, not a generic Vizzy greeting

