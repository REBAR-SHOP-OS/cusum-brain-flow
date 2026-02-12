
# Fix: Voice Vizzy Calls Not Working

## Root Cause

The current approach relies on Vizzy **speaking** `[VIZZY-ACTION]{"type":"ringcentral_call",...}[/VIZZY-ACTION]` tags aloud during voice sessions. This fails because:

1. ElevenLabs converts the response to speech — the JSON gets garbled or spoken as words ("bracket vizzy action bracket...")
2. Even if the text is captured in `agent_response`, the formatting is often broken (spaces, line breaks, punctuation added by the TTS model)
3. The `ringcentral-action` edge function logs show **zero calls** — confirming the regex never matches

The voice page already has a working pattern: `draft_quotation` is registered as an **ElevenLabs client tool** (line 163), which the voice AI can call as a structured function. We need to do the same for calls and SMS.

## Solution

Register `make_call` and `send_sms` as ElevenLabs **client tools** in `VizzyPage.tsx`. These are functions the voice AI can invoke directly with typed parameters — no text parsing needed.

**Note:** The ElevenLabs agent configuration (on their platform, referenced by `ELEVENLABS_AGENT_ID`) must also have these tools defined. If they're not already configured there, the voice AI won't know to call them. However, based on the existing `draft_quotation` pattern, the agent likely already has tool definitions that match.

## Technical Changes

### File: `src/pages/VizzyPage.tsx`

**A. Add two new client tools** in the `useConversation` config (alongside `draft_quotation`, around line 163):

```typescript
clientTools: {
  // Existing tool
  draft_quotation: (params) => { ... },

  // NEW: Make a phone call via RingCentral
  make_call: async (params: { phone: string; contact_name?: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "ringcentral-action",
        { body: { type: "ringcentral_call", phone: params.phone, contact_name: params.contact_name } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Calling ${params.contact_name || params.phone}...`);
      return "Call initiated successfully";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Call failed: ${msg}`);
      return `Call failed: ${msg}`;
    }
  },

  // NEW: Send an SMS via RingCentral
  send_sms: async (params: { phone: string; message: string; contact_name?: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "ringcentral-action",
        { body: { type: "ringcentral_sms", phone: params.phone, message: params.message, contact_name: params.contact_name } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`SMS sent to ${params.contact_name || params.phone}`);
      return "SMS sent successfully";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`SMS failed: ${msg}`);
      return `SMS failed: ${msg}`;
    }
  },
}
```

**B. Keep the existing `[VIZZY-ACTION]` text parsing as a fallback** (lines 251-271) — in case the text chat path is still used. No removal needed.

## What This Changes

- Voice Vizzy will call `make_call({ phone: "+16472601941", contact_name: "Neel" })` as a **structured function call** instead of trying to speak JSON tags
- The function executes immediately — no approval dialog, no text parsing
- Toast notifications confirm success or show errors
- The existing text-chat action tag parsing remains as a fallback

## Scope
- 1 file modified: `src/pages/VizzyPage.tsx`
- No backend changes needed
- No new components
