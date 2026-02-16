

# Governance Restructure: Vizzy = Rebar.shop, ARIA = All Companies

## Summary

Redefine the ARYA governance framework so that:
- **Vizzy** is scoped to **rebar.shop** as its dedicated Ops Commander, managing all 14 agents for this specific company
- **ARIA** becomes the **multi-company supervisor** -- overseeing Vizzy (rebar.shop) and any future company Ops Commanders

This positions the platform for multi-tenant expansion where each company gets its own "Vizzy" while ARIA orchestrates across all of them.

## What Changes

### 1. Update Vizzy's System Prompt (Chain of Command section)

Current:
- ARYA supervises Vizzy
- Vizzy is "Ops Commander"

Updated to:
- **Vizzy** is the Ops Commander **for Rebar.shop specifically**
- Reports to **ARIA**, who manages all companies
- Vizzy's scope is explicitly tied to rebar.shop operations, team, agents, and data
- All 14 agents remain Vizzy's direct reports **within rebar.shop**

### 2. Update ARIA's Role Definition

Current: "Supervisor and Coach" (vague)

Updated to:
- **ARIA** is the **cross-company orchestrator** and strategic supervisor
- Currently manages one company (Rebar.shop via Vizzy) but architected for future expansion
- ARIA's approval authority spans all companies:
  - New company onboarding
  - Cross-company resource sharing
  - Permission escalations across any company
  - Strategic decisions that affect the platform as a whole
- ARIA coaches each company's Ops Commander (currently just Vizzy)

### 3. Scope Boundaries

```text
ARIA (Platform Supervisor)
  |
  +-- Vizzy (Rebar.shop Ops Commander)
  |     +-- Blitz, Commander, Penny, Gauge, Forge, Atlas...
  |     +-- (all 14 rebar.shop agents)
  |
  +-- [Future Company B Ops Commander]
  |     +-- [Company B agents]
  |
  +-- [Future Company C Ops Commander]
        +-- [Company C agents]
```

## Technical Details

### File Modified
`supabase/functions/ai-agent/index.ts`

### Changes:
1. **Vizzy's prompt (line ~1498-1560)**: Update the governance section to scope Vizzy explicitly to "Rebar.shop" and clarify ARIA as the multi-company supervisor
2. **ARIA references throughout**: Replace "ARYA" with "ARIA" consistently (the user spells it ARIA) and update the role description from "Supervisor and Coach" to "Cross-Company Platform Supervisor"
3. **Decision rights**: Vizzy decides autonomously within rebar.shop; ARIA approves cross-company and platform-level changes

No database changes required. No new files.

