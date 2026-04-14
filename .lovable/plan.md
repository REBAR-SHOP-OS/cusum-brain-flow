

## Plan: Enhanced Architecture Report Dialog

### Problem
The current explain dialog shows only basic bullets and a flat list of connections. The user wants a comprehensive architectural report that clearly shows: what the component does, its internal functions, and directional connections (what sends data TO it vs what it sends data TO).

### Changes

**1. `src/pages/Architecture.tsx` — Enhance the detail dialog**
- Split "Connected to" into two sections: **Inbound** (→ this node) and **Outbound** (this node →)
- Show edge labels (e.g., "sync", "auth", "cache") next to each connection badge
- Show edge style type (solid = primary, dashed = async, failure = error path) with visual indicators
- Add a summary line: "X inbound · Y outbound connections"
- Add the component's layer name prominently
- Show the full detail title + all bullets in a structured "Functions & Capabilities" section

**2. `src/lib/architectureGraphData.ts` — Add `description` field to `ArchNode`**
- Add an optional `description: string` field to each node for a one-line purpose statement (e.g., "Manages the full sales pipeline from lead capture to deal closure")
- Populate for all ~100 nodes with concise architectural descriptions

**3. `src/pages/Architecture.tsx` — Wire description into dialog**
- Display the description below the title as a summary paragraph before bullets

### Visual Result
```text
┌─────────────────────────────────────────┐
│ 🔀 Pipeline                         ✕  │
│ ┌──────────┐                            │
│ │ AI Layer │  Workflows                 │
│ └──────────┘                            │
│                                         │
│ Orchestrates automated workflows with   │
│ cron, webhook, and manual triggers.     │
│                                         │
│ ▸ FUNCTIONS                             │
│   • Workflow definitions                │
│   • Execution log                       │
│   • Cron, webhook, manual triggers      │
│                                         │
│ ▸ MINI CONNECTION GRAPH                 │
│   [existing graph]                      │
│                                         │
│ ▸ INBOUND (3)                           │
│   CRM ──→  •  Shop Floor ──→           │
│   Estimating ──verify→                  │
│                                         │
│ ▸ OUTBOUND (8)                          │
│   ──→ Social (publish)                  │
│   ──→ Stripe                            │
│   ──→ Rules Engine                      │
│   ──→ Job Queue (enqueue)               │
│   ──→ Gmail  ──→ RC  ──→ SEO           │
│   ──→ Message Bus (publish)             │
│                                         │
│ 3 inbound · 8 outbound connections      │
└─────────────────────────────────────────┘
```

### Files
| File | Change |
|---|---|
| `src/lib/architectureGraphData.ts` | Add optional `description` field to `ArchNode`, populate for all nodes |
| `src/pages/Architecture.tsx` | Restructure dialog: add description, split connections into inbound/outbound with edge labels and direction arrows |

