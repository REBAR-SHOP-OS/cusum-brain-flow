

# Train All Agents to Generate Smart Ideas for Employees

## What Already Exists

The infrastructure is already built:
- `notifications` table supports `type = "idea"`
- `InboxPanel` already shows an Ideas section with accept/dismiss
- Agents already have a `create_notifications` tool with `type: "idea"` option
- `suggestions` table exists for foreman brain optimizations

What's missing: **agent-level instructions telling each agent WHEN and WHAT ideas to create**. Currently, no agent prompt mentions idea generation. This change adds idea-generation training to every agent.

## What Changes

**Single file:** `supabase/functions/ai-agent/index.ts`

### 1. Add `IDEA_GENERATION_INSTRUCTIONS` constant (after `SHARED_TOOL_INSTRUCTIONS`)

A new shared block that all agents inherit, teaching them the concept of ideas vs tasks:

```text
## Proactive Idea Generation (ALL AGENTS)

You can create "ideas" — these are suggestions, NOT commands.
Ideas help employees work smarter. Use type: "idea" with create_notifications.

RULES:
- Ideas are based on REAL DATA from context — never fabricate
- Ideas are optional — employees accept or dismiss them
- Keep ideas specific and actionable (not vague advice)
- Maximum 2-3 ideas per conversation — quality over quantity
- Set priority based on potential impact (high = money/safety, normal = efficiency, low = nice-to-have)
- Always explain WHY in the description (the data that triggered the idea)
- Link ideas to the relevant app route (link_to field)
```

### 2. Add role-specific idea triggers to each agent prompt

Each agent gets a new "Ideas You Should Create" section in their existing prompt:

| Agent | Idea Triggers |
|-------|--------------|
| **Blitz (Sales)** | Customer inactive 45+ days, quote sent but no response 3+ days, high-margin product not offered to active customer, lead stagnant in pipeline |
| **Penny (Accounting)** | Invoice overdue but customer still ordering, payment pattern changed, HST filing deadline approaching, month-end tasks not started |
| **Haven (Support)** | Same question asked 3+ times this week (needs FAQ/canned reply), customer contacted multiple times without resolution, delivery complaint pattern |
| **Collections** | Invoice overdue but customer is active (easy win), partial payment pattern detected, customer approaching lien preservation deadline |
| **Gauge (Estimation)** | Similar project to recent bid (reuse takeoff), drawing revision received but not yet reviewed, estimate approaching expiry |
| **Pixel (Social)** | Platform with no posts in 14+ days, trending industry topic not covered, competitor posted but we haven't, content calendar gap |
| **Buddy (BizDev)** | New tender matching our capabilities, dormant customer segment, competitor weakness identified, partnership opportunity |
| **Commet (Web)** | Page speed issue detected, missing meta descriptions, blog content gap for high-volume keyword |
| **Vizzy (Assistant)** | Overdue tasks piling up, meeting without agenda, cross-department bottleneck spotted |
| **Penn (Copy)** | Email template performing poorly, proposal section outdated, case study opportunity from completed project |
| **Scouty (Talent)** | Certification expiring, seasonal hiring window approaching, training gap identified, overtime pattern suggesting understaffing |
| **Seomi (SEO)** | Keyword ranking dropped, competitor content outranking us, seasonal search trend approaching |
| **Gigi (Growth)** | Employee milestone approaching (anniversary, probation end), training not completed, skill gap in team |
| **Tally (Legal)** | Contract renewal approaching, lien deadline within 30 days, compliance certificate expiring |
| **Eisenhower** | Repeated Q4 tasks that should be eliminated, delegation patterns not being used |

### 3. Inject into system prompt assembly

Update the prompt construction to include the idea generation instructions — added to the `systemPrompt` concatenation alongside `ONTARIO_CONTEXT`, `ROLE_ACCESS_BLOCK`, and `SHARED_TOOL_INSTRUCTIONS`.

## Technical Details

- Each agent prompt gets 5-10 additional lines specifying their idea triggers
- The shared `IDEA_GENERATION_INSTRUCTIONS` block (~15 lines) is prepended once
- Ideas flow through the existing `create_notifications` tool call with `type: "idea"`
- No database changes needed — `notifications` table already supports ideas
- No frontend changes needed — `InboxPanel` already renders ideas with accept/dismiss

## Implementation

1. Add the `IDEA_GENERATION_INSTRUCTIONS` constant
2. Append idea trigger sections to each of the 15 agent prompts
3. Include the instructions in the system prompt assembly line
4. Deploy the edge function

