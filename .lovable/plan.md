

## Plan: Reorder Architecture Layers — Macro to Micro

### Goal
Reorganize the architecture diagram so the hierarchy flows from the most important/strategic level (LLMs) down to the operational details (Agents), following a macro-to-micro structure.

### Current Layer Order (top → bottom)
1. Entry Points (cyan)
2. Access Control (emerald)
3. Business Modules (orange)
4. AI / Automation (violet)
5. Integrations (blue)
6. External Services (rose)
7. Data + Platform (emerald)

### New Layer Order (macro → micro)
1. **External Services** — Which LLMs & platforms (OpenAI, ElevenLabs, Meta, Google, etc.)
2. **AI / Automation** — AI systems, rules engines, state machines, knowledge
3. **Business Modules** — CRM, Shop Floor, Accounting, etc.
4. **Integrations** — Edge functions connecting to services
5. **Access Control** — Auth, RBAC, routing
6. **Entry Points** — Web App, Webhooks, Kiosk
7. **Data + Platform** — DB, storage, queues, monitoring

### Changes

**`src/lib/architectureGraphData.ts`** — Reorder `LAYERS` array and update `y` values:
```typescript
export const LAYERS = [
  { key: "external", label: "External Services",  accent: "rose",    y: 0 },
  { key: "ai",       label: "AI / Automation",    accent: "violet",  y: 1 },
  { key: "modules",  label: "Business Modules",   accent: "orange",  y: 2 },
  { key: "backend",  label: "Integrations",       accent: "blue",    y: 3 },
  { key: "auth",     label: "Access Control",     accent: "emerald", y: 4 },
  { key: "entry",    label: "Entry Points",       accent: "cyan",    y: 5 },
  { key: "platform", label: "Data + Platform",    accent: "emerald", y: 6 },
];
```

This is a single array reorder — the layout engine already uses the `y` value from this array to position nodes vertically. All nodes, edges, and interactions remain unchanged.

### Result
- Top of diagram: LLM providers (OpenAI, ElevenLabs, Google, etc.)
- Middle: AI agents & business modules
- Bottom: Infrastructure & data platform
- All existing connections, click behavior, and styling preserved

