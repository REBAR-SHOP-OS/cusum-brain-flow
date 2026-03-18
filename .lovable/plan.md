
Audit result: the cage parsing patch is partly in place, but Blitz can still behave as if the quote succeeded because the prompt has conflicting instructions.

What’s happening
- The backend already normalizes `scope.cages` in both `agentToolExecutor.ts` and `quoteCalcEngine.ts`.
- The quote engine already blocks $0 totals with a failure response.
- The real remaining bug is prompt/flow conflict:
  - `sales.ts` adds “Quote Recovery Mode”
  - but a few lines later it still says “Immediately call save_sales_quotation … Do NOT ask for approval first”
  - so Blitz can still narrate success/save behavior after a failed quote
- Conversation state is not explicitly persisted as “quote recovery”; it currently depends only on prior chat text, which is fragile.

Surgical fix plan

1. Tighten Blitz prompt priority in `supabase/functions/_shared/agents/sales.ts`
- Make Quote Recovery Mode highest priority over every auto-quote / auto-save rule.
- Add explicit rule: if `generate_sales_quote` returns `success: false`, `quote_recovery: true`, `pricing_status: failed`, or `failure_reason`, Blitz must not:
  - say “I created a quote”
  - say “quote saved”
  - ask whether to proceed saving
  - call `save_sales_quotation`
- Add explicit recovery wording: ask only for missing cage fields and preserve all previously provided scope.

2. Add explicit recovery-state handoff in `supabase/functions/ai-agent/index.ts`
- When tool results include quote recovery / pricing failure, inject a short system follow-up instruction before the next model call:
  - “You are in quote recovery mode for this conversation.”
  - “Do not claim success or saving.”
  - “Ask only for missing inputs.”
- This keeps the current conversation in recovery mode without changing schema or UI.

3. Strengthen tool result shape in `supabase/functions/_shared/agentToolExecutor.ts`
- Keep existing normalization/$0 interception.
- Standardize failure payload so recovery signals are always obvious to the model:
  - `success: false`
  - `quote_recovery: true`
  - `pricing_status: "failed"`
  - `failure_reason`
  - `missing_inputs`
  - `message`
- Ensure the non-200 quote-engine branch and $0 interception branch return the same recovery structure.

4. Optional micro-hardening in `supabase/functions/_shared/quoteCalcEngine.ts`
- Keep the existing cage validation.
- Add one more defensive validation message if a cage object is present but lacks enough fabrication structure to be considered a real cage, so Blitz gets clearer missing-input prompts.

Why this should fix your screenshot case
- The backend is already failing the quote correctly.
- Blitz is likely reading that tool result, then following the older “auto-save / report success” instructions.
- By forcing recovery mode to outrank auto-save and by injecting recovery state during the tool loop, the reply should change from “I created a quote…” to “I couldn’t price this yet — I still need X, Y, Z.”

Scope
- No database changes
- No route/UI redesign
- No broad refactor
- Only small edits in the sales prompt, AI tool-loop handling, and tool-result normalization

Technical details
```text
Current failure chain:
user asks cage quote
→ generate_sales_quote runs
→ quote-engine returns failed / zero-total / missing inputs
→ Blitz still has conflicting prompt rules
→ assistant narrates quote creation or save-like success

Patched chain:
user asks cage quote
→ generate_sales_quote runs
→ tool result is normalized as quote_recovery
→ ai-agent injects recovery-mode instruction
→ Blitz asks only for missing cage details
→ no save call, no success wording
```
