

## Fix MCP Server Schema Drift

### Problem
The MCP server queries reference columns that don't exist in the database, causing 3+ tools to crash when called by ChatGPT.

### Schema Drift Map

| Tool | Code references | Actual DB column | Action |
|---|---|---|---|
| `list_social_posts` | `scheduled_at` | `scheduled_date` | Rename in select |
| `list_orders` | `total_weight_kg` | `total_amount` | Rename in select |
| `list_machines` | `location` | (doesn't exist) | Remove from select, add `model` |
| `list_leads` | `contact_name` | (doesn't exist, has `contact_id`) | Replace with `title, contact_id` |
| `list_leads` | `company_name` | (doesn't exist) | Remove |
| `list_leads` | `email` | (doesn't exist) | Remove |
| `list_leads` | `phone` | (doesn't exist) | Remove |
| `list_leads` | `lead_score` | (doesn't exist, has `probability`) | Replace with `probability` |
| `list_leads` | `expected_revenue` | `expected_value` | Rename in select |

### Strategy
**Option B: Fix the code to match the real DB.** The database is the source of truth. No migrations needed.

### Changes

**File: `supabase/functions/mcp-server/index.ts`**

1. **`list_social_posts`** (line 43): Change select from `scheduled_at` to `scheduled_date`

2. **`list_leads`** (lines 70-71): Change select from
   `"id, contact_name, company_name, email, phone, stage, lead_score, expected_revenue, source, created_at"`
   to
   `"id, title, contact_id, stage, probability, expected_value, source, priority, created_at"`

3. **`list_machines`** (line 148): Change select from
   `"id, name, type, status, location, company_id, created_at"`
   to
   `"id, name, model, type, status, company_id, created_at"`

4. **`list_orders`** (line 173): Change select from
   `"id, order_number, customer_id, status, total_weight_kg, notes, created_at"`
   to
   `"id, order_number, customer_id, status, total_amount, notes, created_at"`

### After fix
- Redeploy the `mcp-server` edge function
- Test all endpoints to confirm they return data without errors

### No other changes
- No migrations
- No frontend changes
- No config changes
