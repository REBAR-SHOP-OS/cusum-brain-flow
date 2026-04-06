

# ADHD-Proof Architecture Diagram — Max Readability Upgrade

## What Changes

Massive expansion of the architecture graph data (7 layers, ~65 nodes, ~70 edges with labels and styles) and layout tuning for crystal-clear scanning. Same dark neon look, same React Flow engine, same interactive features.

## 7 Layers (top to bottom)

```text
Layer 1 — Entry Points (cyan)        : Web App, Webhooks, Crons, OAuth, Kiosk
Layer 2 — Access Control (emerald)   : Auth, RoleGuard, Agent Router, API Gateway
Layer 3 — Business Modules (orange)  : CRM, Shop Floor, Team Hub, Accounting, SEO, Video, Email, Chat
Layer 4 — AI / Automation (violet)   : Vizzy, Pipeline, Autopilot, QA War, Ad Director, Nila, Approval Engine, State Machine, Rules Engine
Layer 5 — Integrations (blue)        : Social, Stripe, RingCentral, Gmail, Odoo, QuickBooks, SEO Engine, AI Gateway, Push
Layer 6 — External Services (rose)   : Meta, Stripe, RingCentral, Google, Odoo, QuickBooks, OpenAI
Layer 7 — Data + Platform (emerald)  : Primary DB, Object Storage, Redis Cache, Search Index, Event Log, Job Queue, Worker Pool, Retry Queue, Dead Letter Queue, Monitoring, Error Tracking, CI/CD, Secrets Manager, Backups, Admin Console, CDN/Edge
```

## New Nodes Added (20 new)

Under existing layers:
- **Access Control**: API Gateway (hub node)
- **AI / Automation**: Approval Engine, State Machine, Rules Engine

Under **Data + Platform** (new layer 7): Primary DB, Object Storage, Redis Cache, Search Index, Event Log, Job Queue, Worker Pool, Retry Queue, Dead Letter Queue, Monitoring, Error Tracking, CI/CD, Secrets Manager, Backups, Admin Console, CDN/Edge

## Edge System — 3 Styles + Labels

### ArchEdge interface update
```typescript
export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  edgeStyle?: "solid" | "dashed" | "failure";  // NEW
  label?: string;  // NEW — micro-label
}
```

### Connection routing via hub nodes
- Entry → API Gateway → Auth (not direct)
- Modules → Job Queue for async work
- AI → Approval Engine for approval flows
- Backend → Event Log for audit
- Retry Queue ← failures from Worker Pool
- Dead Letter Queue ← failures from Retry Queue

### Edge style mapping in Architecture.tsx
- `solid` → normal stroke (primary flow)
- `dashed` → `strokeDasharray: "6 4"`, animated (async/events)
- `failure` → red dashed stroke, `strokeDasharray: "4 3"` (retry/fallback)

### Micro-labels on key edges
auth, approve, sync, publish, webhook, retry, fail, cache, search, audit

## Layout Changes (Architecture.tsx)

| Constant | Old | New | Why |
|---|---|---|---|
| `LAYER_GAP` | 180 | 220 | More breathing room for 7 layers |
| `NODE_GAP` | 20 | 30 | Reduce visual crowding |
| `NODE_W` | 130 | 130 | Keep same |
| `LEFT_MARGIN` | 180 | 160 | More canvas width |
| `TOP_MARGIN` | 60 | 40 | Start higher |

Canvas centers each layer's nodes horizontally across a wider reference (1200px instead of 900px).

## Workflow Status Strip

A compact horizontal lane rendered as a fixed overlay at the top of the canvas showing:
```
Draft → Review → Approved → Queued → Processing → Complete
                                        ↓
                               Failed → Retry → Dead Letter
```
Pure visual — no interactive logic. Styled as tiny pills with arrows, matching the neon theme.

## Color Rules (enforced via accent assignment)

- **Cyan** = Entry / Access (layers 1-2)
- **Orange** = Business Modules (layer 3)
- **Violet** = AI / Automation (layer 4)
- **Blue** = Integrations (layer 5)
- **Rose** = External Services (layer 6)
- **Emerald** = Data + Platform (layer 7)

## Files Changed

### `src/lib/architectureGraphData.ts` — Major expansion
- Add `"platform"` to `ArchLayer` type
- Add `edgeStyle` and `label` to `ArchEdge`
- Add 7th layer to `LAYERS` array
- Add ~20 new nodes
- Rewrite edges with hub routing, styles, and labels (~70 edges)
- Update `LAYER_LABELS`

### `src/pages/Architecture.tsx` — Layout + edge rendering
- Update layout constants (GAP, margins)
- Map `edgeStyle` → React Flow edge styles (solid/dashed/failure colors)
- Render edge labels from data
- Add workflow status strip overlay
- Widen centering reference

### `src/components/system-flow/ArchFlowNode.tsx` — No changes

## Impact
- Only Architecture page changes
- All existing nodes preserved
- All interactive features preserved (drag, connect, edit, delete)
- No routing, auth, or data changes

