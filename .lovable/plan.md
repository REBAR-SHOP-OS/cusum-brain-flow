

# Fix Supabase 400 Error — Leads Query Column Mismatch

## Problem

The `leads` table query in `src/hooks/useVizzyContext.ts` (line 56-58) references **5 columns that don't exist**:

| Query uses | Actual column | Fix |
|-----------|--------------|-----|
| `contact_name` | Does not exist (name is on `contacts` table via `contact_id` FK) | Join or remove |
| `company_name` | Does not exist (name is on `customers` table via `customer_id` FK) | Join or remove |
| `status` | `stage` | Rename |
| `expected_revenue` | `expected_value` | Rename |
| `lead_score` | `probability` | Rename |

This causes a **400 Bad Request** on every Vizzy context load, which means Vizzy never gets CRM data.

## Fix

### File 1: `src/hooks/useVizzyContext.ts`

**Line 56-58** — Replace the leads query with correct column names:

```typescript
const leadsP = (supabase.from("leads").select("id, title, stage, expected_value, probability, customer_id, contact_id") as any)
  .in("stage", ["new", "contacted", "qualified", "proposal"])
  .order("probability", { ascending: false }).limit(20);
```

**Line 177** — Fix the hot leads filter:

```typescript
hotLeads: leads.filter((l: any) => (l.probability || 0) >= 70).slice(0, 5),
```

### File 2: `src/lib/vizzyContext.ts`

**Line 31-33** — Update the hot leads display to use correct field names:

```typescript
const hotLeadsList = crm.hotLeads
  .map((l) => `  * ${l.title} — Probability: ${l.probability}%, Expected: ${fmt(l.expected_value || 0)}`)
  .join("\n");
```

(We use `title` instead of `contact_name`/`company_name` since those require a join. The lead title already contains enough context for Vizzy.)

## Impact

- Eliminates the 400 error on every Vizzy page load
- Vizzy will actually receive CRM pipeline data for context
- No schema changes needed — purely a frontend query fix

## Summary

| File | Change |
|------|--------|
| `src/hooks/useVizzyContext.ts` | Fix column names in leads query and hot leads filter |
| `src/lib/vizzyContext.ts` | Fix field references in hot leads display string |
