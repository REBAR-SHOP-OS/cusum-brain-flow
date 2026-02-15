

## Deep-Training Upgrade: Atlas (Delivery Navigator)

### Current State Audit

| Area | What Exists | Gap |
|------|------------|-----|
| **System Prompt** | Basic 6-responsibility prompt (25 lines) | No morning briefing, no team directory, no QC gate awareness, no ARIA escalation, no Ontario geography knowledge |
| **Context Data** | 3 queries: deliveries (20), delivery_stops (50), orders (15) | Missing: customer names for stops, work_order completion %, QC status of orders, driver history/patterns, production readiness |
| **Morning Briefing** | None | Forge and Commander both have structured briefings; Atlas has zero |
| **Model Routing** | Single tier: `gemini-2.5-flash` (2K tokens, temp 0.4) | Route planning and multi-stop optimization need `gemini-2.5-pro`; quick status checks could use `flash-lite` |
| **QC Gate** | DB trigger `block_delivery_without_qc` exists but Atlas has no awareness | Atlas should warn dispatchers before loading if QC is incomplete |
| **Tables** | deliveries (0 rows), delivery_stops (0 rows) | Schema is ready but empty -- Atlas must handle "no data yet" gracefully |

---

### Implementation Plan

#### 1. Upgrade System Prompt

Expand Atlas from 25 lines to a full logistics commander prompt:

**New sections:**
- **Team Directory**: Driver roster, dispatcher name, vehicle fleet info
- **Ontario Geography Awareness**: GTA corridors, 400-series highways, common construction site areas (Brampton, Mississauga, Vaughan, Hamilton, etc.)
- **QC Gate Rules**: "Before confirming any delivery as ready-to-load, check `qc_evidence_uploaded` and `qc_final_approved` on linked orders. If either is false, flag with a warning -- the DB trigger will block the delivery anyway"
- **Load Planning Logic**: Group stops by geographic proximity, heaviest orders loaded first (LIFO unloading), max stops per truck guidance
- **Delay Detection Rules**:
  - Scheduled delivery is today but status still "planned" --> flag as "Not dispatched"
  - Stop has arrival_time but no departure_time for > 2 hours --> "Driver stuck at site"
  - Order has `required_date` < 48 hours but no delivery scheduled --> "Unscheduled urgent order"
- **ARIA Escalation Protocol**: `[ATLAS-ESCALATE]` tag for production delays affecting delivery promises, capacity issues, or customer complaints

#### 2. Enrich Context Data

Add to `fetchContext` when `agent === "delivery"`:

| New Data | Source | Query | Purpose |
|----------|--------|-------|---------|
| Customer names | `contacts` via `delivery_stops.customer_id` | Join customer_id to get name/phone | Show WHO is receiving, not just address |
| Order QC status | `orders` | `qc_evidence_uploaded`, `qc_final_approved` on delivery-linked orders | QC gate awareness |
| Order required_date | `orders` | Already in schema | Know delivery urgency |
| Work order progress | `work_orders` joined via `orders` | Status, completion % | Know if production is ready for delivery |
| Recent delivery history | `deliveries` where status = completed, last 14 days | Past performance patterns |
| Orders needing delivery | `orders` where status in ('confirmed','in_production') and required_date within 7 days | Proactive delivery planning |

#### 3. Add Morning Briefing

Greeting-triggered structured **Delivery Briefing**:

```text
**Delivery Briefing -- [Date]**

### 1. Today's Dispatches
| Delivery # | Driver | Vehicle | Stops | Status | First Stop ETA |
(from deliveries where scheduled_date = today)

### 2. Stop Details
| Stop | Customer | Address | Order # | QC Ready? | Status |
(from delivery_stops linked to today's deliveries)

### 3. Orders Awaiting Delivery
| Order # | Customer | Required Date | Production Status | QC Status |
(orders with required_date in next 7 days, no delivery scheduled)

### 4. Delivery Risks
- Late deliveries (past required_date)
- QC incomplete on scheduled deliveries
- Unassigned orders due soon
- Driver availability gaps

### 5. Actions for Dispatcher
Numbered, specific, with urgency level
```

Model override: `gemini-2.5-pro` with `maxTokens: 4500`, `temperature: 0.2`

#### 4. Upgrade Model Routing

| Query Type | Current | Upgraded |
|-----------|---------|----------|
| Route planning, multi-stop optimization, briefing | `gemini-2.5-flash` (2K) | `gemini-2.5-pro` (4K, temp 0.2) |
| Quick status checks ("where is delivery X?") | `gemini-2.5-flash` (2K) | `gemini-2.5-flash-lite` (1.5K) |
| Default logistics queries | `gemini-2.5-flash` (2K) | Keep as-is |

#### 5. Add ARIA Escalation

```text
[ATLAS-ESCALATE]{"to":"aria","reason":"Production delay on Order ORD-1234","urgency":"high","context":"Required date is Feb 17 but work order is only 30% complete. Customer expecting delivery."}[/ATLAS-ESCALATE]
```

Trigger conditions:
- Order required_date < 48 hours but production < 80% complete
- QC blocked delivery with customer already notified of ETA
- No driver/vehicle available for scheduled delivery
- Multiple delivery exceptions on same route (customer complaints)

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ai-agent/index.ts` | 1. Expand Atlas system prompt with QC gate rules, Ontario geography, load planning, delay detection, ARIA escalation. 2. Enrich context with customer names, QC status, order urgency, work order progress. 3. Add morning briefing detection block. 4. Upgrade model routing with Pro for complex queries and flash-lite for simple status. |

### No Database Changes Required

All data sources (deliveries, delivery_stops, orders, contacts, work_orders) already exist.
