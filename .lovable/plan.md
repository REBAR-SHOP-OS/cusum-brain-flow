

# Add Details Field to Phone Calls

## What Changes

The phone AI currently has no content to discuss because only the call "reason" (a short label) is passed. We need to thread a `details` field through so the chat agent can include substantive information.

## Changes

### 1. PennyCallCard.tsx -- Add `details` to data interface and parser

- Add `details?: string` to `PennyCallData`
- Update `parsePennyCalls` to extract the `details` field from the JSON tag

### 2. AccountingAgent.tsx -- Pass details to startBridge

- Line 417-422: Add `details: callData.details` to the `startBridge` call

### 3. ai-agent edge function -- Instruct chat AI to populate details

- Update the PENNY-CALL tag format documentation (around line 818) to include the optional `details` field
- Add instruction: "When calling about reports, briefs, invoices, collections, or any topic where you have data in context, include a summary of the relevant information in the `details` field so the phone AI can discuss it intelligently"
- Example: `[PENNY-CALL]{"phone":"ext:101","contact_name":"Sattar","reason":"Daily brief","details":"12 orders processed yesterday, 3 pending pickup, inventory low on 10M rebar (23 bundles remaining)"}[/PENNY-CALL]`

### 4. Improve no-details fallback behavior

- In `buildPhoneCallOverrides`, update the no-details prompt to be more conversational: instead of repeating "I don't have details," the AI should ask the caller what specific topics they'd like to cover

## Technical Details

**PennyCallCard.tsx parser change:**
```typescript
// In parsePennyCalls, add details extraction
calls.push({
  phone: data.phone,
  contact_name: data.contact_name,
  reason: data.reason || "",
  details: data.details,  // NEW
  lead_id: data.lead_id,
  contact_id: data.contact_id,
});
```

**AccountingAgent.tsx startBridge call:**
```typescript
startBridge(session, {
  agentName: "Penny",
  contactName: callData.contact_name,
  reason: callData.reason,
  phone: callData.phone,
  details: callData.details,  // NEW
});
```

**ai-agent prompt update (line ~818):**
```
[PENNY-CALL]{"phone":"ext:101","contact_name":"Person Name","reason":"Brief reason","details":"Optional: key facts and data the phone AI should discuss"}[/PENNY-CALL]
```

**No-details fallback improvement (useCallAiBridge.ts ~244):**
```typescript
const noDetailsWarning = !details
  ? `\n\nIMPORTANT: No specific details were provided. Do NOT fabricate any. Instead, ask the caller what they would like to discuss and offer to have someone from Rebar Shop follow up with specifics.`
  : "";
```

## Files Modified

- `src/components/accounting/PennyCallCard.tsx`
- `src/components/accounting/AccountingAgent.tsx`
- `src/hooks/useCallAiBridge.ts`
- `supabase/functions/ai-agent/index.ts`

