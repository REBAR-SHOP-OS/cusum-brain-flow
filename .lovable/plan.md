

# Redesign: Multi-Layer Interactive Architecture Flow

## Problem
Current Architecture page shows only 5 generic nodes (People, Signals, Core, Partners, You). The user wants to see the **full system architecture** with all real components organized in multiple layers with interactive transitions.

## Design

A multi-layer, zoomable architecture canvas with **6 horizontal layers**, each containing real system components. Nodes are interactive — click to expand details. Edges show data flow with animated transitions.

```text
Layer 1: ENTRY POINTS
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Web App  │ │ Webhooks │ │  Crons   │ │  OAuth   │ │  Kiosk   │
  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
       │             │            │             │             │
Layer 2: AUTH & ROUTING
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Auth     │ │RoleGuard │ │Agent Rtr │
  └────┬─────┘ └────┬─────┘ └────┬─────┘
       │             │            │
Layer 3: CORE MODULES (pages/features)
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
  │CRM ││Shop││Team││Acct││SEO ││Video││Email││Chat│
  └──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘
     │      │     │      │     │      │     │      │
Layer 4: AI & AUTOMATION
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
  │Vizzy││Pipeline││Autopilot││QA War││Ad Dir││Nila│
  └──┬─┘└──┬─┘└────┬──┘└──┬─┘└──┬─┘└──┬─┘
     │      │       │       │      │      │
Layer 5: EDGE FUNCTIONS (backend)
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
  │social││stripe││ring ││gmail││odoo ││qb  ││seo │
  └──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘└──┬─┘
     │      │      │      │      │      │      │
Layer 6: EXTERNAL SERVICES
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
  │Meta ││Stripe││RC  ││Google││Odoo ││QB  ││OpenAI│
  └────┘└────┘└────┘└────┘└────┘└────┘└────┘
```

### Features
- **Layer filter sidebar**: Toggle layers on/off to focus on specific areas
- **Animated edges**: Bezier curves with flowing particle animation showing data direction
- **Node groups**: Nodes are color-coded by layer (cyan=entry, emerald=auth, orange=modules, violet=AI, blue=backend, red=external)
- **Click to expand**: Each node shows its sub-components, related files, and connections
- **Search**: Filter nodes by name
- **Zoom/Pan**: Existing controls enhanced
- **Layer labels**: Vertical labels on the left showing each layer name

### Technical Approach
- Keep using the custom canvas (no React Flow dependency needed for this)
- Define all nodes with layer, position, connections in a data file
- Render with SVG edges + positioned HTML nodes
- Add layer filter state to show/hide layers
- Animated edge particles via CSS keyframes on SVG

## Files Changed
- `src/pages/Architecture.tsx` — complete rewrite with multi-layer canvas, ~50+ nodes organized in 6 layers, layer filter, search, animated edges
- `src/lib/architectureGraphData.ts` — expand with full system node/edge definitions

## Impact
- Only the Architecture page changes
- No other pages, routes, or functionality affected

