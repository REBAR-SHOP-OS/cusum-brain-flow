

# Eliminate Double Greeting: Dashboard Config Required

## The Problem

The code fix is working correctly -- the logs confirm overrides are sent and acknowledged before audio streaming begins. The remaining double greeting comes from the **ElevenLabs dashboard configuration**.

When the WebSocket connects, ElevenLabs immediately fires the agent's dashboard-configured "First message" -- this happens server-side before our override can replace it. So the caller hears:
1. The dashboard's default greeting (fired instantly by the server)
2. Our code-based override greeting (sent moments later)

## The Fix (Manual -- No Code Changes Needed)

You need to make this change in your **ElevenLabs dashboard**:

1. Go to https://elevenlabs.io and sign in
2. Navigate to the **Conversational AI** section
3. Find the agent associated with your **phone agent** (the one using `ELEVENLABS_PHONE_AGENT_ID`)
4. Set the **"First message"** field to **completely empty/blank** (delete all text)
5. Make sure **"Allow client overrides"** is toggled **ON**
6. Save the agent

This ensures the agent stays silent on connect and only speaks the greeting sent by our code.

## Why No Code Change Is Needed

The code is already doing everything correctly:
- Sends overrides immediately on WebSocket open
- Waits for `conversation_initiation_metadata` before starting audio capture
- Has a 3-second safety timeout as fallback
- Guards against duplicate connections via `bridgeActiveRef`

The double voice is purely a server-side config issue at this point.

## After Dashboard Change

Once you clear the First Message in the dashboard, test again. You should hear only ONE greeting from Penny with the correct context for the call.

