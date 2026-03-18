

## Plan: Fix Quote Engine Crash + Integrate Accounting Agent

### Issues Found

**1. Quote Engine Crash** — `req.scope.straight_rebar_lines is not iterable`
The edge function logs confirm the error. When the AI agent calls `generate_sales_quote`, it passes a `scope` object where arrays like `straight_rebar_lines`, `fabricated_rebar_lines`, etc. may be `undefined` instead of `[]`. The `generateQuote` function uses `for...of` loops on these fields, which crashes when they're undefined.

**2. Blitz Still Asks Questions** — Despite the prompt saying "do NOT ask clarifying questions," the AI still asks "what does 20 refer to?" This is because the prompt structure has the smart defaults instructions but the "validate" action instructions come first and the LLM defaults to that behavior.

### Changes

**1. `supabase/functions/_shared/quoteCalcEngine.ts` — Defensive array handling**
At the top of both `generateQuote` and `validateEstimateRequest` functions, normalize `req.scope` to ensure all array fields default to `[]`:
```typescript
const scope = {
  straight_rebar_lines: req.scope?.straight_rebar_lines || [],
  fabricated_rebar_lines: req.scope?.fabricated_rebar_lines || [],
  dowels: req.scope?.dowels || [],
  ties_circular: req.scope?.ties_circular || [],
  cages: req.scope?.cages || [],
  mesh: req.scope?.mesh || [],
  coating_type: req.scope?.coating_type || "black",
  shop_drawings_required: req.scope?.shop_drawings_required || false,
  scrap_percent_override: req.scope?.scrap_percent_override ?? null,
  tax_rate: req.scope?.tax_rate ?? 13,
};
```
Then use `scope` instead of `req.scope` throughout.

**2. `supabase/functions/_shared/agentToolExecutor.ts` — Normalize estimate_request before sending**
In the `generate_sales_quote` handler (line ~270), add normalization of the estimate_request body to ensure scope arrays are always arrays before calling the quote-engine:
```typescript
const er = body.estimate_request;
if (er?.scope) {
  er.scope.straight_rebar_lines = er.scope.straight_rebar_lines || [];
  er.scope.fabricated_rebar_lines = er.scope.fabricated_rebar_lines || [];
  er.scope.dowels = er.scope.dowels || [];
  er.scope.ties_circular = er.scope.ties_circular || [];
  er.scope.cages = er.scope.cages || [];
  er.scope.mesh = er.scope.mesh || [];
}
```

**3. `supabase/functions/_shared/agents/sales.ts` — Strengthen auto-quote prompt**
Move the smart defaults and "NEVER ask questions" instruction higher in the quoting section and make it more forceful. Reword to:
- **CRITICAL RULE: When a user provides ANY rebar info (e.g., "100 15mm 20 foot"), you MUST call generate_sales_quote with action "quote" immediately. NEVER use "validate". NEVER ask clarifying questions.**
- Also add: when numbers are ambiguous (like "20"), default to 20 feet length.

### Files to Change
1. `supabase/functions/_shared/quoteCalcEngine.ts` — defensive scope normalization in `generateQuote` and `validateEstimateRequest`
2. `supabase/functions/_shared/agentToolExecutor.ts` — normalize estimate_request scope arrays
3. `supabase/functions/_shared/agents/sales.ts` — strengthen auto-quote behavior, eliminate question-asking

