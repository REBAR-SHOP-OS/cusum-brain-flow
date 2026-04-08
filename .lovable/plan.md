

# Add Role Descriptions & Report Button to Each Agent Row

## What Changes

**File:** `src/components/vizzy/VizzyBrainPanel.tsx`

### 1. Add role descriptions to ALL_KNOWN_AGENTS

Each agent gets a `role` field describing its function in English:

| Agent | Role |
|-------|------|
| Blitz | Sales & Pipeline |
| Penny | Accounting & Invoices |
| Tally | Legal & Compliance |
| Haven | Customer Support |
| Pixel | Social Media |
| Gauge | Estimating & Quotes |
| Forge | Shop Floor & Production |
| Atlas | Business Development |
| Relay | Delivery & Logistics |
| Rex | Data & Analytics |
| Prism | Growth & Coaching |
| Ally | Talent & HR |
| SEO | Search Engine Optimization |
| Copywriting | Content & Copy |
| Web Builder | Website Management |
| Email | Email Management |
| Empire | Ventures & Architecture |
| Rebuild | System Architecture |
| Eisenhower | Priority Matrix |
| Vizzy | Operations Commander |

### 2. Display role under agent name

Show the role as a small muted subtitle text next to or under the agent name in each row:
```
🤖 Blitz — Sales & Pipeline
```

### 3. Add report icon button

Add a `ClipboardList` icon button next to each agent row (outside the accordion trigger). When clicked, it opens a dialog/modal showing:
- Agent name + role
- Domain stats (from `useAgentDomainStats`)
- Session/message breakdown per user (existing data)
- Formatted as a clean English report

The report modal will use the existing `Dialog` component pattern already used elsewhere in VizzyBrainPanel.

### 4. Report modal content

The modal will show:
- **Header:** Agent name + role
- **Domain Metrics:** All stats for that agent in a clean list
- **Today's Activity:** Sessions count, messages count, active users
- **User Breakdown:** Table of users with their session/message counts
- If no data: "No activity recorded today"

## Files Modified

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add `role` to `ALL_KNOWN_AGENTS`, show role subtitle, add report icon button + report dialog |

