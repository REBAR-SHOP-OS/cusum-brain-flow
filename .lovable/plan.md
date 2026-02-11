
# Role-Aware Agent Access Control

## What This Does

Every user can talk to every agent, but each agent will know the user's role level and automatically filter what information it shares. A workshop worker can ask Penny a question, but Penny won't reveal financial details like invoice amounts, AR aging, or customer credit limits. Instead, she'll answer at the appropriate level or redirect.

## How It Works

One change to `supabase/functions/ai-agent/index.ts`:

### 1. Fetch user roles server-side (after line 2176)

After fetching the user profile, also fetch their roles from `user_roles`:

```
const { data: userRoles } = await svcClient
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id);
const roles = (userRoles || []).map(r => r.role);
```

### 2. Add a new `ROLE_ACCESS_RULES` constant

This block defines what each role level can and cannot see, injected into the system prompt:

```text
## Role-Based Information Access (MANDATORY)

Current user roles: [admin, sales, etc.]

ACCESS LEVELS:
- ADMIN: Full access to everything -- financials, HR, strategy, operations
- ACCOUNTING: Full financial data, invoices, AR/AP, payroll, tax
- OFFICE: Orders, customers, deliveries, scheduling, production overview
- SALES: Pipeline, leads, quotes, customer contacts, estimating
- WORKSHOP: Machine status, production queue, their own jobs, safety info. 
  CANNOT SEE: Financial data (invoice amounts, AR, revenue, margins, payroll, credit limits), 
  HR data (salaries, performance reviews), strategic data (business plans, competitor analysis)
- FIELD: Delivery routes, their assigned stops, POD. 
  CANNOT SEE: Same restrictions as workshop

ENFORCEMENT RULES:
1. If a workshop/field user asks about finances, say: 
   "That information is managed by the office team. I can help you with [relevant alternatives]."
2. Never reveal dollar amounts, margins, or revenue to workshop/field users
3. Workshop users CAN see: their own hours, machine specs, production counts, safety rules
4. If unsure whether to share, DON'T -- redirect to appropriate department
5. Admin users bypass all restrictions
```

### 3. Inject into the system prompt (line 2260)

Update the prompt assembly to include role context:

```
const roleList = roles.join(", ") || "none";
const isRestricted = !roles.some(r => ["admin","accounting","office","sales"].includes(r));

const ROLE_ACCESS_BLOCK = `\n\n## Current User Access Level\nRoles: ${roleList}\n${isRestricted ? RESTRICTED_RULES : "Full access granted."}`;

const systemPrompt = ONTARIO_CONTEXT + basePrompt + ROLE_ACCESS_BLOCK + SHARED_TOOL_INSTRUCTIONS + `\n\n## Current User\nName: ${userFullName}\nEmail: ${userEmail}`;
```

## What Each Role Sees Per Agent

| Agent | Admin | Office/Sales/Accounting | Workshop/Field |
|-------|-------|------------------------|----------------|
| Penny (Accounting) | Everything | Everything | General advice only, no amounts |
| Blitz (Sales) | Everything | Pipeline + leads | "Talk to the sales team" |
| Gauge (Estimating) | Everything | Everything | Drawing questions OK, no pricing |
| Forge (Shop Floor) | Everything | Overview | Full access (their domain) |
| Atlas (Delivery) | Everything | Overview | Their routes only (their domain) |
| Vizzy (Assistant) | CEO mode | Department-scoped | Basic task help |
| All others | Everything | Domain-appropriate | General guidance only |

## File Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Fetch user roles, add `ROLE_ACCESS_RULES` constant, inject into prompt assembly |

No frontend changes needed. No database changes needed. The `user_roles` table and `has_role` function already exist.
