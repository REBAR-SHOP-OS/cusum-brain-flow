

## Fix: Parameter Mismatch — Voice Vizzy's Calls, SMS, and Fax Are Silently Broken

### Root Cause

Voice Vizzy's instructions tell the AI to output actions with **wrong parameter names**. The backend `vizzy-erp-action` expects different field names, so every voice-initiated call/SMS/fax **silently fails**.

| Action | Voice instruction says | Backend expects | Result |
|---|---|---|---|
| `rc_send_sms` | `"to"`, `"text"` | `"phone"`, `"message"` | Fails: "phone and message are required" |
| `rc_make_call` | `"to"` | `"phone"` | Fails: "phone is required" |
| `rc_send_fax` | `"to"`, `"cover_page_text"` | `"fax_number"`, `"cover_page_text"` | Fails: "fax_number is required" |

Also: when `rc_make_call` returns `browser_action: "webrtc_call"`, `VizzyVoiceChat.tsx` doesn't handle it — it just counts as "other" and does nothing.

### Fix: 2 Files

#### 1. Fix voice instruction parameter names
**File**: `src/hooks/useVizzyVoiceEngine.ts` (lines 127-129)

Change:
```text
BEFORE: {"type":"rc_make_call","to":"+14155551234"}
AFTER:  {"type":"rc_make_call","phone":"+14155551234"}

BEFORE: {"type":"rc_send_sms","to":"+14155551234","text":"Message here"}
AFTER:  {"type":"rc_send_sms","phone":"+14155551234","message":"Message here"}

BEFORE: {"type":"rc_send_fax","to":"+14155551234","cover_page_text":"..."}
AFTER:  {"type":"rc_send_fax","fax_number":"+14155551234","cover_page_text":"..."}
```

#### 2. Handle WebRTC call action in voice frontend
**File**: `src/components/vizzy/VizzyVoiceChat.tsx` (~line 127)

After executing `rc_make_call`, check for `browser_action === "webrtc_call"` in the response and dispatch a custom event to trigger the RingCentral Embeddable widget:

```typescript
} else if (actionData.type === "rc_make_call") {
  if (data?.browser_action === "webrtc_call" && data?.phone) {
    window.dispatchEvent(new CustomEvent("rc-webrtc-call", { detail: { phone: data.phone } }));
  }
  results.other++;
}
```

Also improve toast tracking for calls/fax:
```typescript
// Track calls and fax separately in results
results = { tasks: 0, emails: 0, calls: 0, other: 0, errors: 0 }
```

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useVizzyVoiceEngine.ts` | Fix parameter names in RC action examples (phone, message, fax_number) |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Handle WebRTC call response + improve toast tracking for calls/fax |

### What This Fixes
- Voice "call Neel" will actually place a call instead of silently failing
- Voice "text Neel" will actually send SMS instead of silently failing  
- Voice "fax this" will actually send fax instead of silently failing
- Call placement triggers the RingCentral WebRTC widget in-browser

