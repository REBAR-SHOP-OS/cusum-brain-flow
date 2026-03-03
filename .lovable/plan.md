

## Add Financial + Full Business Tools to MCP Server

### Problem
The MCP server currently only exposes operational tools (leads, customers, orders, deliveries, production, machines, time entries, team channels). ChatGPT cannot access any financial data (invoices, bills, AR/AP, payments), communications, activity logs, knowledge base, profiles, or write operations.

### Changes to `supabase/functions/mcp-server/index.ts`

**Add these new read tools:**

1. **`list_invoices`** — Query `accounting_mirror` where `entity_type = 'Invoice'`. Return `quickbooks_id, balance, data, last_synced_at`. Supports filter: `overdue_only` (boolean, filters where `balance > 0` and `data->DueDate < today`).

2. **`list_bills`** — Query `accounting_mirror` where `entity_type = 'Vendor'`. Same shape. Supports `overdue_only` filter.

3. **`get_financial_summary`** — Aggregate tool: total AR (sum of Invoice balances), total AP (sum of Vendor balances), overdue invoice count, overdue bill count. Single snapshot for bird's-eye view.

4. **`list_communications`** — Query `communications` table. Filters: `direction` (inbound/outbound), `status`, `ai_category`. Returns subject, from/to, body_preview, ai_urgency, ai_action_required, received_at.

5. **`list_activity_events`** — Query `activity_events`. Filter by `event_type`, `entity_type`. Returns recent 50 events with description, actor, timestamps.

6. **`list_profiles`** — Query `profiles`. Returns full_name, title, department, email, phone, is_active, employee_type.

7. **`list_knowledge`** — Query `knowledge` table. Returns title, category, content. Filter by `category`.

8. **`list_cut_plans`** — Query `cut_plans` (currently only in dashboard counts). Filter by `status`.

9. **`list_packing_slips`** — Query `packing_slips`. Returns delivery_id, items_json, created_at.

**Add these write tools:**

10. **`update_lead`** — Update a lead's stage, priority, expected_value, or notes by ID.

11. **`update_order_status`** — Update an order's status by ID.

12. **`update_delivery_status`** — Update a delivery's status by ID.

13. **`create_activity_event`** — Insert a new activity event (for logging actions taken by ChatGPT).

14. **`send_team_message`** — Insert a message into `team_messages` for a given channel.

### No database changes needed
All tables already exist. This is purely adding MCP tool registrations in the edge function.

### Security
- All tools remain behind the existing `MCP_API_KEYV1` auth middleware
- Write tools are scoped to specific fields (no arbitrary SQL)
- Service role key provides full table access server-side

