

## Deep-Training Upgrade: Forge (Shop Floor Commander)

### Current State Audit

| Area | What Exists | Gap |
|------|------------|-----|
| **System Prompt** | Basic 7-responsibility prompt (lines 1820-1845) | No morning briefing, no team directory, no safety protocols, no machine capability references |
| **Context Data** | 6 tables loaded: machines, machine_runs, cut_plans, cut_plan_items, work_orders, floor_stock | Missing: machine_capabilities (max bar sizes per machine), operator profiles, completed runs (last 7 days for throughput), orders linked to work orders |
| **Morning Briefing** | None -- no greeting detection for shopfloor | Penny and Commander both have structured briefings; Forge has zero |
| **Model Routing** | Complex: `gemini-2.5-flash` (3K tokens). Simple: `flash-lite` (1.5K tokens) | Complex production analysis needs `gemini-2.5-pro` for multi-factor bottleneck reasoning |
| **Tools** | Only `create_notifications` (shared) | No tool for machine status updates, no escalation to ARIA for delivery/material issues |

### Existing Machines in Database

| Machine | Type | Model | Status |
|---------|------|-------|--------|
| CUTTER-01 | cutter | GENSCO DTX 400 | running |
| CUTTER-02 | cutter | GENSCO DTX 400 | idle |
| BENDER-01 | bender | GMS B36 | idle |
| BENDER-02 | bender | GMS B45 | idle |
| BENDER-03 | bender | Rod Chomper BR18 | idle |
| SPIRAL-01 | other | Circular Spiral Bender | idle |

---

### Implementation Plan

#### 1. Upgrade System Prompt

Expand Forge's prompt from the current 25 lines to a comprehensive production commander prompt:

**New sections to add:**

- **Team Directory**: Kourosh Zand (Shop Supervisor), operators by machine assignment
- **Machine Capabilities Reference**: "When assigning work, check `machineCapabilities` context -- each machine has max bar size and max bars per run"
- **Safety Protocols**: Always flag safety concerns first. Overloaded machines, exceeded capacity, missing operator assignments
- **Production Priority Logic**: Work orders with nearest `scheduled_start` get priority. Orders with `in_production` status take precedence over `confirmed`
- **Bottleneck Detection Rules**: Explicit formulas:
  - Cutter queue > 5 items AND bender queue = 0 --> "Bender starving"
  - Machine running > 12 hours --> "Cooldown recommended"
  - Cut plan item at < 50% progress with scheduled_end in < 3 days --> "At risk"
- **ARIA Escalation Protocol**: When Forge detects material shortage, delivery conflict, or capacity issue affecting customer promises, output structured escalation tag

**File**: `supabase/functions/ai-agent/index.ts` -- replace lines 1820-1845

#### 2. Enrich Context Data

Add to `fetchContext` when `agent === "shopfloor"`:

| New Data | Table | Query | Purpose |
|----------|-------|-------|---------|
| Machine capabilities | `machine_capabilities` | All rows (small table) | Know max bar size, max bars per machine |
| Operator profiles | `profiles` via `machines.current_operator_profile_id` | Join on active machines | Know who is operating what |
| Completed runs (7 days) | `machine_runs` where status=completed, last 7 days | Throughput/productivity analysis |
| Linked orders | `orders` via `work_orders.order_id` | Status, order_number, scheduled dates | Know delivery deadlines driving production priority |
| Scrap tracking | `machine_runs` | Sum scrap_qty by machine, last 7 days | Waste analysis |

**File**: `supabase/functions/ai-agent/index.ts` -- expand the shopfloor context block (lines 2626-2672)

#### 3. Add Morning Briefing

When Forge detects a greeting, generate a structured **Shop Floor Briefing**:

```text
**Shop Floor Briefing -- [Date]**

### 1. Machine Status
| Machine | Status | Operator | Current Run | Pieces Done/Total |
(from machineStatus + activeRuns + operator profiles)

### 2. Production Queue
| Priority | Work Order | Order # | Bar Code | Pieces | Phase | Due Date |
(from cutPlanItems sorted by linked order delivery date)

### 3. Bottlenecks & Risks
- Items at risk (< 50% progress, due in < 3 days)
- Machine imbalances (cutter queue vs bender queue)
- Machines down or blocked

### 4. Yesterday's Output
| Machine | Runs Completed | Pieces | Scrap | Efficiency |
(from completedRuns last 24 hours)

### 5. Actions for Kourosh
Numbered, specific, assigned with urgency level
```

Model override: `gemini-2.5-pro` with `maxTokens: 5000`, `temperature: 0.2`

**File**: `supabase/functions/ai-agent/index.ts` -- add briefing detection block after Commander's briefing (around line 4573)

#### 4. Upgrade Model Routing

| Query Type | Current | Upgraded |
|-----------|---------|----------|
| Complex (maintenance, bottleneck, cage, capacity, schedule) | `gemini-2.5-flash` (3K tokens) | `gemini-2.5-pro` (4K tokens, temp 0.2) |
| Quick status | `flash-lite` (1.5K tokens) | Keep as-is |
| Briefing | N/A | `gemini-2.5-pro` (5K tokens, temp 0.2) |

**File**: `supabase/functions/ai-agent/index.ts` -- lines 3549-3566

#### 5. Add ARIA Escalation

Forge outputs a structured tag when detecting cross-department issues:

```text
[FORGE-ESCALATE]{"to":"aria","reason":"Material shortage for WO-1234","urgency":"high","context":"Floor stock for 20M is 0, need 500 pieces by Friday"}[/FORGE-ESCALATE]
```

Trigger conditions:
- Floor stock for a required bar code = 0 but cut plan needs it
- Work order scheduled_start passed but status still "queued"
- Machine down with active production queue > 10 items
- Delivery deadline < 48 hours but production < 50% complete

Added to the system prompt instructions.

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ai-agent/index.ts` | 1. Expand Forge system prompt with team directory, safety protocols, bottleneck formulas, ARIA escalation. 2. Enrich context with machine_capabilities, operator profiles, completed runs, linked orders, scrap data. 3. Add morning briefing detection block. 4. Upgrade model routing for complex queries to Pro. |

### No Database Changes Required

All data sources already exist in the database (machines, machine_capabilities, machine_runs, work_orders, orders, floor_stock, profiles).

