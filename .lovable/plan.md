

# Connect Website Agent to Live ERP Data (No Financials)

## Summary

Enrich the website-agent and support-chat AI with live ERP data from the knowledge base, delivery areas, and company info so the AI can answer deeper questions about rebar.shop — while explicitly blocking all financial data (invoices, bills, AR/AP, bank accounts, margins, payroll).

## What Changes

### 1. New Tool: `search_knowledge_base` (website-agent)

Add a tool that queries the `knowledge` table for public-safe categories only:
- Allowed categories: `webpage`, `company-playbook`, `document`, `research`
- Excluded categories: `meetings`, `memory`, `agent-strategy`, `agent-response`, `social-strategy`
- Returns title + truncated content (max 500 chars per entry, max 5 results)
- This lets the AI answer questions about Australian rebar standards (ASA bend chart), machine specs (GMS brochures), company processes, and the price list

### 2. New Tool: `get_delivery_info` (website-agent)

Add a tool that returns hardcoded delivery coverage areas (since no `delivery_zones` table exists):
- Greater Sydney, Central Coast, Blue Mountains, Wollongong, Newcastle
- Standard lead times and minimum order info
- This lets the AI answer "Do you deliver to my area?" questions accurately

### 3. Enrich System Prompt with Company Context

Update `buildSystemPrompt` in website-agent to include:
- Rebar standards context (Australian AS/NZS 4671)
- Common bar sizes with basic specs inline (so AI doesn't always need tool calls for simple questions)
- Fabrication capabilities (cutting, bending, scheduling)
- Service areas with suburbs
- Operating hours
- Contact details (phone, email from public website)

### 4. Support-Chat AI: Add Knowledge Base Context

Update `triggerAiReply` in `support-chat/index.ts` to also query the `knowledge` table (public-safe categories) alongside `kb_articles`, giving the support chat bot access to the same ERP knowledge without financials.

### 5. Explicit Data Firewall

Add a clear block in the website-agent system prompt:
```
NEVER share: financial data, invoices, bills, bank balances, AR/AP, 
profit margins, employee salaries, internal meeting notes, or 
strategic plans. If asked about pricing, always direct to a formal quote.
```

This ensures even if tools return adjacent data, the AI knows not to expose it.

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/website-agent/index.ts` | Add `search_knowledge_base` and `get_delivery_info` tools, enrich system prompt with company data and data firewall, add tool execution logic |
| `supabase/functions/support-chat/index.ts` | Add knowledge table query alongside kb_articles in `triggerAiReply` |

### Data Access Rules (Firewall)

**Allowed for website visitors:**
- Product catalog (WooCommerce via WP API)
- Rebar specifications (`rebar_sizes` table)
- Stock availability (`floor_stock` table -- quantities only, no costs)
- Knowledge base (public categories only)
- Delivery areas (hardcoded)
- Quote request creation

**Blocked from website visitors:**
- `accounting_mirror` (invoices, bills, balances)
- `orders` (internal order data)
- `profiles` / `user_roles` (employee data)
- `communications` (internal emails)
- `leads` (pipeline data)
- `employee_salaries`, `leave_requests`
- Any financial KPIs, margins, or cost data
- Meeting notes, agent strategies, social strategies

### Knowledge Base Tool Query

```sql
SELECT title, LEFT(content, 500) as content, category
FROM knowledge
WHERE category IN ('webpage', 'company-playbook', 'document', 'research')
  AND content ILIKE '%search_term%'
ORDER BY created_at DESC
LIMIT 5
```

### No Database Changes Required

All data sources already exist. We're just adding new read-only tools to the website-agent that query existing tables with restricted access.
