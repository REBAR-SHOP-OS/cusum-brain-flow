

## Connect Voice Vizzy to Your Real Business Data

### Problem
Voice Vizzy is powered by ElevenLabs' AI agent, which has no access to your database or QuickBooks. When you ask about revenue, it makes up numbers.

### Solution
When the Vizzy voice session starts, we pull your live QuickBooks summary (revenue, AR, AP, bank balances, overdue invoices) and inject it into the conversation as context. Vizzy will then reference your real numbers.

### How it works

1. **Update `VizzyPage.tsx` and `VoiceVizzy.tsx`** to fetch QuickBooks data before starting the ElevenLabs session
2. After the session connects, call `conversation.sendContextualUpdate(...)` with a formatted summary of your financials
3. Vizzy will receive this context and use real numbers instead of hallucinating

### What data Vizzy will know
- Total Accounts Receivable and Accounts Payable
- Overdue invoices (count, total, top customers)
- Overdue bills (count, total, top vendors)
- Bank account balances
- Recent payments received

### Technical details

**In both `VizzyPage.tsx` and `VoiceVizzy.tsx`:**

- Import and call `useQuickBooksData` hook to get `loadAll`, `totalReceivable`, `totalPayable`, `overdueInvoices`, `overdueBills`, `accounts`, `payments`
- After `conversation.startSession(...)` succeeds, build a context string with the real financial data and call:
  ```
  conversation.sendContextualUpdate(contextString)
  ```
- The context string will include a preamble telling the agent: "You have access to live financial data. Use ONLY these numbers. Never make up financial figures."

**Edge function (`elevenlabs-conversation-token`)**: No changes needed -- the data injection happens client-side after the session starts.

**No new dependencies or secrets required** -- we reuse the existing `useQuickBooksData` hook and the ElevenLabs SDK's built-in `sendContextualUpdate` method.

### Files changed
- `src/pages/VizzyPage.tsx` -- add QB data fetch and contextual update
- `src/components/vizzy/VoiceVizzy.tsx` -- add QB data fetch and contextual update
