

# Add 10 Missing Real Systems to Architecture Diagram

## What's Missing (verified against codebase)

| # | System | Evidence in Codebase | Proposed Node |
|---|--------|---------------------|---------------|
| 1 | **Knowledge / RAG** | `knowledge` table, `embed-documents`, `search-embeddings` functions | `knowledge-rag` in AI layer |
| 2 | **Estimating Engine** | `extract_sessions`, `extract_rows`, `ai-estimate`, `manage-extract` | `estimating` in Modules layer |
| 3 | **Sales Quotes** | `quote-engine`, `sales_quotation_items`, `send-quote-email` | `quotes` in Modules layer |
| 4 | **Notification Hub** | `notifications` table, `push-on-notify`, `approval-notify`, `comms-alerts` | `notif-hub` in AI layer |
| 5 | **Payroll** | `payroll-engine` edge function | `payroll` in Modules layer |
| 6 | **Camera / Security** | `camera-events`, `camera-ping`, `face-recognize`, `synology-proxy` | `cameras` in Backend layer |
| 7 | **Website Agent** | `website-chat`, `website-agent`, `website-chat-widget` | `fn-website` in Backend layer |
| 8 | **Inbox / Comms** | `sms_templates`, `translate-message`, `draft-email` | `inbox` in Modules layer |
| 9 | **ElevenLabs** | `elevenlabs-tts`, `elevenlabs-music`, `elevenlabs-scribe-token` | `ext-eleven` in External layer |
| 10 | **MCP Server** | `mcp-server` edge function | `fn-mcp` in Backend layer |

## Changes

### File: `src/lib/architectureGraphData.ts`

**Add 10 new nodes** (one per system above):

- **Modules layer** (3 new): `estimating` (Estimating, OCR+AI), `quotes` (Quotes, Sales quotes), `payroll` (Payroll, Wages), `inbox` (Inbox, Unified comms)
- **AI layer** (2 new): `knowledge-rag` (Knowledge, RAG store), `notif-hub` (Notifications, Alert routing)
- **Backend layer** (2 new): `cameras` (Cameras, Security), `fn-website` (Website, Agent+chat), `fn-mcp` (MCP, Agent protocol)
- **External layer** (1 new): `ext-eleven` (ElevenLabs, Voice+TTS)

**Add ~15 new edges**:

- `role-guard` → `estimating`, `quotes`, `payroll`, `inbox` (access control)
- `estimating` → `qa-war` (verification flow)
- `quotes` → `fn-stripe` (payment)
- `inbox` → `fn-gmail` + `fn-ring` (send)
- `knowledge-rag` → `primary-db` (persist)
- `vizzy` → `knowledge-rag` (RAG lookup)
- `nila` → `knowledge-rag` (RAG lookup)
- `notif-hub` → `fn-push` (deliver)
- `approval-eng` → `notif-hub` (alert)
- `cameras` → `ext-eleven` or external (not needed — cameras is self-contained)
- `fn-website` → `fn-ai` (AI responses)
- `fn-mcp` → `agent-rtr` (protocol bridge)
- `vizzy` → `ext-eleven` (voice synthesis)
- `fn-website` → `ext-google` (analytics)

**Add icon imports**: `Ruler` (estimating), `FileSpreadsheet` (quotes), `Banknote` (payroll), `Inbox` (inbox), `Library` (knowledge), `BellRing` (notif-hub), `Camera` (cameras), `Globe2` (website), `Plug` (MCP), `AudioLines` (ElevenLabs)

Total: 67 → 77 nodes, 90 → ~105 edges.

### File: `src/pages/Architecture.tsx`

No changes needed — the wrapping logic (`MAX_PER_ROW = 10`) handles wider layers automatically.

## Impact
- Only `architectureGraphData.ts` changes
- Layout auto-adapts
- All existing nodes/edges preserved
- No interaction or style changes

