

# Fix Voice Vizzy's Email Access

## Problem
The email access fix we applied only affects **text chat Vizzy** (via `ai-agent/index.ts`). **Voice Vizzy** (ElevenLabs) uses a completely different data pipeline:
- Context is built by `src/hooks/useVizzyContext.ts` and formatted by `src/lib/vizzyContext.ts`
- Neither of these files fetch or include email data
- The `VizzyBusinessSnapshot` type has no email field
- So when the CEO asks about emails over voice, Vizzy literally has zero email data and correctly says it can't access them

## Root Cause
Two missing pieces:
1. `useVizzyContext.ts` never queries the `communications` table
2. `vizzyContext.ts` never formats or includes email data in the context string sent to ElevenLabs

## Fix

### 1. Add emails to `VizzyBusinessSnapshot` type
**File:** `src/hooks/useVizzyContext.ts`

Add a new field to the interface:
```typescript
inboundEmails: { subject: string; from_address: string; to_address: string; body_preview: string; received_at: string }[];
```

### 2. Fetch inbound emails in `loadFullContext`
**File:** `src/hooks/useVizzyContext.ts`

Add a query alongside the other parallel fetches:
```typescript
const emailsP = supabase
  .from("communications")
  .select("subject, from_address, to_address, body_preview, received_at")
  .eq("direction", "inbound")
  .ilike("to_address", "%@rebar.shop%")
  .order("received_at", { ascending: false })
  .limit(50);  // Keep smaller for voice context (token limits)
```

Include it in the `Promise.all` and assign to `snap.inboundEmails`.

### 3. Format emails into voice context string
**File:** `src/lib/vizzyContext.ts`

Add a new section to the context string (after Recent Activity):
```
EMAIL INBOX (last 50 inbound emails to @rebar.shop)
  [subject] from [from_address] to [to_address] — [body_preview snippet] ([date])
```

### 4. Add email access override to voice prompt
**File:** `src/lib/vizzyContext.ts`

Add to the system instructions at the top of `buildVizzyContext`:
```
You have FULL access to business emails listed below. When asked about emails,
search the EMAIL INBOX section by sender, subject, or content. NEVER say you
cannot read emails — the data is right here in your context.
```

## Technical Details
- Voice context is limited by ElevenLabs token window, so we fetch only 50 emails (vs 200 for text chat)
- Each email is condensed to one line: subject + from + truncated preview
- The email override instruction goes in the system preamble of `buildVizzyContext` to front-load it before all data

## Summary
- 2 files modified: `src/hooks/useVizzyContext.ts`, `src/lib/vizzyContext.ts`
- Fetches inbound emails and includes them in the voice context
- Adds explicit "you CAN read emails" instruction to the voice prompt
- Keeps payload compact for ElevenLabs token limits

