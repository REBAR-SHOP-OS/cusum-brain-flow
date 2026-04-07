

# Add Missing Infrastructure Nodes to Architecture Diagram

## What's Missing

The diagram is missing several real system components that are actively used:

1. **Memory System** — `vizzy_memory`, `lead_qualification_memory`, `lead_quote_memory`, `lead_loss_memory`, `lead_outcome_memory`, `client_performance_memory` — these are core to how the AI and CRM actually work. No representation on the diagram.
2. **Realtime Engine** — Supabase Realtime powers chat, live dashboards, notifications. Not shown.
3. **Rate Limiter** — mentioned in API Gateway bullets but not a standalone node.
4. **Session Store** — auth sessions, token management. Not shown.
5. **Analytics** — system telemetry, usage tracking. Not shown.
6. **Log Aggregator** — separate from Event Log (audit) — system-level log collection.
7. **Health Checks** — uptime monitoring, endpoint health.
8. **Feature Flags** — mentioned in Admin Console bullets but not explicit.
9. **Message Bus** — event-driven communication between services.

## Plan

### File: `src/lib/architectureGraphData.ts`

Add **9 new nodes** to the platform layer:

| ID | Label | Hint | Why |
|---|---|---|---|
| `memory-store` | Memory | AI & CRM memory | Vizzy brain, lead qualification/quote/loss/outcome memory, client performance memory |
| `realtime` | Realtime | Live events | Supabase Realtime — chat, dashboards, presence |
| `rate-limiter` | Rate Limiter | Throttle | Request rate limiting at API gateway level |
| `session-store` | Sessions | Auth state | Session management, token storage |
| `analytics` | Analytics | Telemetry | Usage metrics, system telemetry |
| `log-agg` | Log Aggregator | System logs | Centralized log collection |
| `health` | Health Check | Uptime | Endpoint health, liveness probes |
| `feature-flags` | Feature Flags | Toggles | Feature toggles, gradual rollouts |
| `msg-bus` | Message Bus | Pub/Sub | Event-driven inter-service communication |

Add **~12 new edges** connecting these nodes:

- `vizzy` → `memory-store` (dashed, label: "remember")
- `nila` → `memory-store` (dashed, label: "remember")
- `crm` → `memory-store` (dashed, label: "qualify")
- `memory-store` → `primary-db` (solid, label: "persist")
- `chat` → `realtime` (solid, label: "live")
- `primary-db` → `realtime` (dashed, label: "stream")
- `api-gw` → `rate-limiter` (solid, label: "throttle")
- `auth` → `session-store` (solid, label: "session")
- `monitoring` → `health` (solid)
- `monitoring` → `analytics` (solid)
- `monitoring` → `log-agg` (solid)
- `admin-console` → `feature-flags` (solid)
- `pipeline` → `msg-bus` (dashed, label: "publish")
- `msg-bus` → `worker-pool` (solid, label: "consume")

Total nodes: 58 → 67. Total edges: 76 → ~88.

### File: `src/pages/Architecture.tsx`

No changes needed — the layout engine already handles row wrapping for layers with >10 nodes (platform layer will go from 16 to 25 nodes, wrapping into 3 rows automatically).

## Impact
- Only `architectureGraphData.ts` changes
- Layout auto-adapts via existing wrapping logic
- All existing nodes/edges preserved
- No interaction or style changes

