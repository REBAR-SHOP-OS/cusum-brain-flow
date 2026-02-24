

## Fix: Sales Agent Cannot Generate Quotes (Quote Engine Integration Broken)

### Problem
When users ask the sales agent (Blitz) for a quote (e.g., "can you quote for a cage, 16 10MM circular ties, 18" dia, 8 15MM vert 10'"), it responds with "internal error with the quote engine" instead of generating a price.

### Root Causes

**1. Invalid action fallback (Bug)**
In `supabase/functions/_shared/agentToolExecutor.ts` line 270:
```typescript
action: args.action || "generate"  // "generate" is NOT a valid action!
```
The quote engine only accepts `"validate"`, `"quote"`, or `"explain"`. If the AI omits the `action` field, it defaults to `"generate"`, which returns a 400 error.

**2. No prompt guidance for quote structure (Missing)**
The sales agent prompt in `supabase/functions/_shared/agents/sales.ts` has no instructions on how to use the `generate_sales_quote` tool. The AI must construct a complex `EstimateRequest` JSON with `meta`, `project`, `scope`, `shipping`, and `customer_confirmations` fields -- but it has no schema reference or examples to follow.

### Solution

**File: `supabase/functions/_shared/agentToolExecutor.ts`**
- Change the action fallback from `"generate"` to `"quote"` (the correct default action)

**File: `supabase/functions/_shared/agents/sales.ts`**
- Add a "Quoting Instructions" section to the sales prompt that:
  - Explains when to use the `generate_sales_quote` tool
  - Provides the exact JSON structure template for `estimate_request`
  - Shows how to map natural language inputs (bar sizes, quantities, cage specs) to the structured format
  - Lists examples of converting common requests (ties, cages, straight bars) to the correct JSON fields
  - Instructs the agent to use `action: "quote"` for generating quotes and `action: "validate"` when info is incomplete

### Technical Detail

**Fix 1 -- `agentToolExecutor.ts` (line 270)**
```typescript
// Before:
action: args.action || "generate",

// After:
action: args.action || "quote",
```

**Fix 2 -- `agents/sales.ts` (add to sales prompt)**
Add a section with the `EstimateRequest` template so the AI knows:
- `scope.ties_circular` expects `{ line_id, type, diameter, quantity }`
- `scope.cages` expects `{ line_id, cage_type, total_cage_weight_kg, quantity }`  
- `scope.straight_rebar_lines` expects `{ line_id, bar_size, length_ft, quantity }`
- `scope.fabricated_rebar_lines` expects `{ line_id, bar_size, shape_code, cut_length_ft, quantity }`
- All unused scope arrays should be empty `[]`
- `meta` and `project` fields can use sensible defaults
- `shipping.delivery_required` defaults to `false` unless the customer mentions delivery
- When information is incomplete, use `action: "validate"` first to get clarifying questions

This ensures the AI can reliably translate natural language quote requests into the structured JSON the deterministic quote engine requires.
