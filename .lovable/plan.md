

# AI App Builder — Full Module Build Plan

## Overview

Build a new **App Builder** workspace at `/app-builder` — a plan-first AI app planning tool with a premium dark UI, orange/amber accent gradients, and a 3-panel builder layout. This replaces the current `/empire` chat-only experience with a structured product.

The existing EmpireBuilder chat agent remains available as a sub-feature (the AI backend), but the new UI wraps it in a proper planning workspace.

## Architecture

```text
/app-builder              → Landing/Hero + Dashboard
/app-builder/:projectId   → 3-panel Builder Workspace
```

**New files (~12 components + 1 page + 1 hook + mock data):**

```text
src/pages/AppBuilder.tsx                         — Route shell, project list + hero
src/components/app-builder/
  AppBuilderHero.tsx                             — Gradient hero card (reference image)
  AppBuilderDashboard.tsx                        — Project cards grid + "Create New"
  AppBuilderWorkspace.tsx                        — 3-panel layout (sidebar/center/right)
  AppBuilderSidebar.tsx                          — Left nav: Overview, Plan, Pages, Data Model, Preview, Versions, Export
  AppBuilderPlanView.tsx                         — Center panel: plan sections (summary, features, pages, data model, readiness)
  AppBuilderPromptBar.tsx                        — Top prompt input with AI generate
  AppBuilderPreviewPanel.tsx                     — Right panel: mock screen previews in device frames
  AppBuilderVersions.tsx                         — Version history list
  AppBuilderExport.tsx                           — Export options cards
  AppBuilderPagePlan.tsx                         — Individual page plan detail
  AppBuilderDataModel.tsx                        — Entity relationship view
src/data/appBuilderMockData.ts                   — "Contractor CRM" sample project with full plan
src/hooks/useAppBuilderProject.ts                — Local state manager for project + sections
```

## Pages

### 1. Hero + Dashboard (`AppBuilder.tsx`)
- Bold gradient hero card matching reference: large orange-to-coral gradient, rounded-2xl, "App Builder" title, subtitle, toggle control, arrow nav icons
- Below: feature highlights (3 cards), CTA
- Dashboard grid of project cards (mock: Contractor CRM, 2 empty slots)
- "Create New App" button opens the workspace with empty state

### 2. Builder Workspace (`AppBuilderWorkspace.tsx`)
3-panel layout, dark bg:

**Left Sidebar** — Icon + label nav: Overview, Plan, Pages, Data Model, Preview, Versions, Export, Settings. Collapsible. Active state highlight with orange accent.

**Center Panel** — Changes based on sidebar selection:
- **Overview**: App summary card, quick stats
- **Plan**: Full plan view with expandable sections (App Plan, Feature Plan, Page Plan, Data Model Plan, Build Readiness badge)
- **Pages**: List of pages with purpose/components/actions
- **Data Model**: Entity cards with fields and relationships
- **Versions**: Version history with timestamps and restore
- **Export**: Export option cards (React, Next.js, Supabase schema) — mock/disabled states

Prompt bar at top of center panel: "Describe the app you want to build..." → triggers plan generation (uses mock data for now, wired to call empire agent later).

**Right Panel** — Preview frame showing mock generated screens (dashboard with stat cards, data table, form, kanban). Device frame wrapper. Page switcher tabs.

## Mock Data — Contractor CRM

Pre-populated sample with:
- 5 pages: Dashboard, Customers, Leads, Projects, Invoices
- 5 entities: Customer, Lead, Project, Invoice, User
- Features: lead tracking, estimate generation, job scheduling, invoicing
- 3 versions with change summaries
- Build readiness: "Medium complexity, ~12 screens, recommended: start with MVP"

## Visual Design

- Background: `bg-[#0A0D14]` dark
- Cards: `bg-white/5 border-white/10 rounded-2xl`
- Accent gradient: `from-orange-500 via-amber-500 to-coral-500`
- Typography: large semibold headings, `text-white/60` secondary
- Hover states: `hover:bg-white/10 hover:border-white/20`
- Shadows: `shadow-2xl shadow-orange-500/5`
- Consistent with existing design-principles memory

## Routing

Update `App.tsx` to add:
```
/app-builder → AppBuilder (dashboard/hero)
/app-builder/:projectId → AppBuilderWorkspace
```

Update `AutomationsSection.tsx` to route app-builder card to `/app-builder` instead of `/empire`.

## Scope Boundaries

- All data is mock/static — no database tables needed
- AI generation is simulated (returns mock plan after 1.5s delay)
- Export buttons are disabled/mock
- Preview screens use hardcoded UI blocks
- The empire agent chat is NOT removed — just decoupled from this new UI

## Files Changed

| File | Action |
|------|--------|
| `src/pages/AppBuilder.tsx` | New — route shell |
| `src/components/app-builder/*.tsx` | New — 12 components |
| `src/data/appBuilderMockData.ts` | New — sample project data |
| `src/hooks/useAppBuilderProject.ts` | New — project state hook |
| `src/App.tsx` | Add routes |
| `src/components/integrations/AutomationsSection.tsx` | Update route to `/app-builder` |

