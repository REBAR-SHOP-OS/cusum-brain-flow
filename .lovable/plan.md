

# Fine-Tune Phone AI Prompt for Better Call Handling

## Problems Identified

1. **Fabrication**: The AI said "everything is proceeding as planned" despite having zero details. The current no-details guard is not aggressive enough.
2. **Term confusion**: When the caller said "daily brief," the AI heard/interpreted it as "daily grief" and couldn't recover. The prompt needs to instruct the AI to handle STT misinterpretations gracefully.
3. **Rephrasing the reason**: The AI changed "Daily brief" to "general daily report," confusing the caller. It should always use the exact reason wording provided.

## Changes

**File: `src/hooks/useCallAiBridge.ts`** -- `buildPhoneCallOverrides` function

### 1. Strengthen the no-details fabrication guard

Replace the current `noDetailsWarning` with a much more explicit instruction that:
- Explicitly forbids generating fake summaries like "everything is on track"
- Tells the AI to immediately say it doesn't have the report content and ask what topics they want covered
- Removes any ambiguity that could lead to fabrication

### 2. Add STT error recovery instructions

Add a new instruction block telling the AI:
- Phone audio can cause mishearing (e.g., "brief" heard as "grief")
- If the caller says something that sounds close to the call reason, assume they mean the call reason
- Never say "I don't have information about X" when X is clearly a mishearing of the call topic

### 3. Lock the reason terminology

Add instruction: "Always refer to the topic using the EXACT wording from PURPOSE OF THIS CALL. Do not rephrase 'daily brief' as 'daily report' or any other variation."

### Updated prompt section (technical detail)

```typescript
const noDetailsWarning = !details
  ? `\n\nCRITICAL — NO DETAILS PROVIDED:
You were NOT given any report content, numbers, or specifics for this call. You ONLY know the reason: "${reason}".
- Do NOT fabricate, summarize, or imply any information. Saying things like "everything is proceeding as planned" is FABRICATION and strictly forbidden.
- Instead, explain that you're calling to connect about "${reason}" and ask the caller what specific topics or questions they have.
- Offer to have someone from Rebar Shop follow up with the full details.`
  : "";

// Add to CRITICAL INSTRUCTIONS:
// - ALWAYS use the EXACT topic wording from PURPOSE OF THIS CALL. Do not rephrase "daily brief" as "daily report" or any other variation.
// - Phone audio quality can cause words to be misheard (e.g., "brief" may sound like "grief"). If the caller says something that sounds similar to the call topic, assume they are referring to it. NEVER say "I don't have information about [misheard word]."
```

## Expected Outcome

- AI will NOT fabricate "everything is on track" when it has no details
- AI will use "daily brief" consistently, not rephrase to "daily report"
- If caller says "daily grief," AI will understand they mean "daily brief" and respond accordingly
- AI will ask what topics the caller wants to discuss instead of repeating it has no information

