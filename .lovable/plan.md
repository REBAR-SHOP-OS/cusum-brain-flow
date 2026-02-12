

# Fine-Tune AI Phone Call Quality

## Problems Identified

1. **AI greets with phone number instead of name** -- The AI said "Am I speaking with 4165870788?" because the `contact_name` field in the PENNY-CALL tag was set to the raw phone number. The greeting template uses `contactName` directly.

2. **AI fabricates content (gibberish)** -- When called to "report daily brief," the AI invented fake report details because the prompt says "use the specific details provided" but no actual details were passed. The AI hallucinated instead of admitting it only has a summary reason.

3. **Delay before AI speaks** -- The 3-second safety timeout may be kicking in instead of the metadata event, adding unnecessary lag.

---

## Fixes

### Fix 1: Handle missing contact name gracefully

**File: `src/hooks/useCallAiBridge.ts`** -- `buildPhoneCallOverrides()`

If `contactName` looks like a phone number (starts with `+` or is all digits), replace it with a generic greeting like "the person I'm trying to reach" in the first message, and note in the prompt that the contact's name is unknown.

```
Before: "Am I speaking with 4165870788?"
After:  "Am I speaking with the person I'm trying to reach?"
```

### Fix 2: Prevent AI from fabricating information

**File: `src/hooks/useCallAiBridge.ts`** -- `buildPhoneCallOverrides()` prompt

Add a strict instruction to the prompt:
- "You ONLY know what is provided in the SPECIFIC DETAILS section. If no details are provided, do NOT invent or fabricate any information."
- "If asked for specifics you do not have, say: 'I don't have the full details on hand, but someone from Rebar Shop will follow up with the complete information.'"

This prevents the AI from hallucinating invoice numbers, report content, etc.

### Fix 3: Reduce safety timeout from 3s to 1.5s

**File: `src/hooks/useCallAiBridge.ts`**

Reduce the fallback timeout from 3000ms to 1500ms. The metadata event typically arrives within a few hundred milliseconds -- 1.5s is still safe but cuts delay in half if the event is missed.

### Fix 4: Improve the PENNY-CALL prompt in ai-agent

**File: `supabase/functions/ai-agent/index.ts`**

Update the PENNY-CALL instructions to ensure:
- `contact_name` must always be the person's actual name, never a phone number
- If the user only provides a phone number with no name, use "the contact" or ask the user for the name first

---

## Technical Details

### buildPhoneCallOverrides changes (useCallAiBridge.ts)

```typescript
// Detect if contactName is actually a phone number
const isPhoneNumber = /^[\d+\-\s()]+$/.test(contactName.trim());
const displayName = isPhoneNumber ? "the person I'm trying to reach" : contactName;

const firstMsg = `Hi, this is ${agentName} calling from Rebar Shop. Am I speaking with ${displayName}? I'm reaching out regarding ${reason}...`;

// In prompt, add:
// - "IMPORTANT: You ONLY know what is explicitly provided below. Do NOT invent, guess, or fabricate any details."
// - "If asked for information you don't have, say someone from Rebar Shop will follow up with full details."
```

### Safety timeout reduction

```typescript
// Change from 3000 to 1500
safetyTimeoutRef.current = setTimeout(() => {
  if (startAudioRef.current) startAudioRef.current();
}, 1500);
```

### ai-agent prompt update

Add to PENNY-CALL instructions:
- "contact_name MUST be the person's real name, NEVER a phone number"
- "If the user only gives a phone number without a name, set contact_name to 'the contact' and proceed"

## Expected Results

- AI greets with a proper name or generic phrase, never a raw phone number
- AI stays honest about what it knows -- no more fabricated reports
- Reduced delay before the AI starts speaking

