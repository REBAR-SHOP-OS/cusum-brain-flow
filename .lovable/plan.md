

# Restrict Ben's Agent Access to 4 Specific Agents

## Problem
Ben (`ben@rebar.shop`, role: `estimator`) currently has access to 6 agents: estimating, sales, email, eisenhower, assistant, growth. He should only access:
- **Blitz** (Sales & Orders) → key: `sales`
- **Haven** (Customer Care) → key: `support`
- **Cal / Gauge** (Job Costing / Estimating) → key: `estimating`
- **Eisenhower** (Priority Matrix) → key: `eisenhower`

**Note:** "Cal" in the AgentSelector maps to the same agent as "Gauge" in agentConfigs (key: `estimating`, agentType: `estimation`).

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`
Update the `estimator` entry in `roleAgentAccess`:
```typescript
estimator: ["sales", "support", "estimating", "eisenhower"],
```

### 2. `src/lib/userAgentMap.ts`
Update Ben's quick actions to cover his 4 accessible agents instead of only estimating-focused ones:
- **Blitz**: "Pipeline overview" (sales)
- **Haven**: "Customer inquiry" (support)
- **Gauge/Cal**: "Open takeoffs" (estimating)
- **Eisenhower**: "Prioritize my tasks" (priority matrix)

Two files, minimal changes. No database changes.

