

## Replace Credit Counter with Total Spend Tracker

### What Changes
Replace the current "12s • Cost: 16s" pill in the prompt bar with a **"Total Spent: $X.XX"** indicator that queries the `credit_ledger` table and sums all `reserve` entries (minus `refund` entries) for the current user.

### Technical Approach

**1. New hook: `useTotalSpend` (or add to `useVideoCredits.ts`)**
- Query `credit_ledger` for current user, sum amounts by type (`reserve` vs `refund`)
- Convert credit-seconds to dollar cost using provider rates:
  - Veo/Sora: internal credits (free tier)
  - Wan: ~$0.07/s
- Return `totalSpent` as a dollar amount

**2. Update `VideoStudioPromptBar.tsx` (lines 496-503)**
- Replace the `{remaining}s • Cost: {creditCost}s` pill with `Total Spent: $X.XX`
- Change prop from `creditCost`/`remaining` to `totalSpent: number`
- Keep the `Gauge` icon, show dollar amount

**3. Update `VideoStudioContent.tsx`**
- Pass `totalSpent` from the hook to the prompt bar instead of `creditCost`/`remaining`

### Simplest Option
Since the `credit_ledger` tracks amounts as credit-seconds and doesn't store dollar values, and Wan is billed externally, the simplest approach is to query the ledger for total consumed seconds and show that alongside an estimated dollar total based on provider. Alternatively, just show **total seconds used** across all time — keeping it simple and accurate.

I'll query `credit_ledger` summing `reserve` minus `refund` amounts, and display as **"Spent: Xs total"** or convert to dollars if you prefer.

### Files Modified
- `src/components/social/VideoStudioPromptBar.tsx` — replace cost pill UI
- `src/components/social/VideoStudioContent.tsx` — pass new prop
- `src/hooks/useVideoCredits.ts` — add total spend query

