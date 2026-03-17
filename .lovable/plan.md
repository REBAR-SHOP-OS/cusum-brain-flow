

# Automation Cards UX Overhaul

## Scope
Apply the audit recommendations across **all** automation cards — not just AI Video Director. This ensures consistency.

## Changes

### 1. Update `Automation` interface
Add optional `highlights` (string array, max 2-3 bullets) to the type definition.

### 2. Rewrite card copy for all 12 automations
Shift every description from technical jargon to benefit-oriented language. Example changes:

| Card | Current description | New description |
|------|-------------------|-----------------|
| AI Video Director | "Script-to-video 30s B2B ad production" | "Turn sales scripts into polished 30s B2B ads in minutes" |
| Social Media Manager | "Auto-schedule and post to social platforms" | "Save hours — auto-schedule and publish across all channels" |
| Email Marketing | "AI-driven campaigns with human approval" | "Launch targeted campaigns with AI copy and human approval" |
| SEO Manager | "AI-driven SEO audits for rebar.shop" | "Boost rankings with automated SEO audits and fixes" |
| *(others follow same pattern)* | | |

Add `highlights` to select cards (Video Director, Email Marketing, Social Media) with 1-2 short benefit bullets.

### 3. Redesign `AutomationCard` component
- **Reduce decorative icon**: Shrink from `w-16 h-16` to `w-10 h-10`, lower opacity from `0.20` to `0.10`.
- **Render highlights**: If present, show 1-2 compact bullet lines (text-xs, white/60) between description and toggle.
- **Consistent card height**: Add `min-h-[140px]` so all cards align in the grid regardless of content length.
- **Toggle positioning**: Move toggle + badge to bottom of card with `mt-auto` (use flex-col on inner content).
- **Remove bottom glow overlay** — the gradient-to-t from black/20 adds visual noise.

### 4. Layout
No grid changes. Same 2-column `md:grid-cols-2` layout.

## File touched
- `src/components/integrations/AutomationsSection.tsx` — interface, data array, and card component updates.

Single file edit. No database changes.

