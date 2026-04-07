

# Restrict Zahra's Agent Access to 4 Specific Agents

## Problem
Zahra (`zahra@rebar.shop`) currently has the `social_media_manager` role mapping, which gives her access to 9 agents (social, copywriting, seo, webbuilder, email, eisenhower, assistant, growth). She should only have access to:
- **Pixel** (Social Media) — `social`
- **Eisenhower Matrix** (Priority Matrix) — `eisenhower`
- **Haven** (Customer Care) — `support`
- **Tally** (Legal & Compliance) — `legal`

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`
Update the `roleAgentAccess` map — change `social_media_manager` from its current broad list to exactly these 4 agent keys:

```typescript
social_media_manager: ["social", "eisenhower", "support", "legal"],
```

### 2. `src/lib/userAgentMap.ts`
Update Zahra's quick actions to match her restricted agent set — replace current quick actions (which are all social-media focused) with actions covering all 4 agents she has access to.

### 3. `src/components/chat/AgentSelector.tsx`
No changes needed — the agent selector already shows all agents; access filtering happens in VizzyBrainPanel for the report view.

Single-line change in VizzyBrainPanel + quick actions update in userAgentMap. No database changes.

