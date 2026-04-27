# System Architecture Module — PDF Documentation

Generate a comprehensive PDF (`/mnt/documents/System_Architecture_Module.pdf`) that fully documents the `/architecture` page so it can be used as a debugging reference.

## Scope

The PDF will cover the entire Architecture visualization module — the React Flow-based "System Architecture" map shown at `/architecture` (108 nodes / 176 connections across 7 layers).

## PDF Structure (≈8–10 pages)

1. **Cover & Overview**
   - Purpose of the module, route (`/architecture`), tech stack (React Flow / @xyflow/react)
   - High-level numbers: 108 components, 176 connections, 7 layers, 214+ edge functions

2. **Frontend Architecture**
   - `src/pages/Architecture.tsx` (984 lines) — main page: state, layers toggle, search filter, fullscreen, "Functions" panel toggle, node/edge rendering
   - Components in `src/components/system-flow/`:
     - `ArchFlowNode.tsx` — custom node renderer
     - `LayerHeaderNode.tsx` — column headers per layer
     - `EdgeFunctionsPanel.tsx` — sliding panel listing 214+ edge functions
     - `EdgeFunctionDetailDialog.tsx` — detail modal with callers + related
     - `MiniConnectionGraph.tsx` — radial mini-graph of a node's neighbors

3. **Data Layer**
   - `src/lib/architectureGraphData.ts` — `ARCH_NODES`, `ARCH_EDGES`, `LAYERS` definitions
   - `src/lib/architectureFlow.ts` — horizontal layout algorithm (`applyArchitectureLayout`, layer columns, wrapping at `maxPerColumn=50`, header generation)
   - `src/lib/edgeFunctionsRegistry.ts` — edge function metadata (category, accent, triggers)
   - `src/lib/edgeFunctionConnections.ts` — frontend-caller mapping

4. **Layers Breakdown**
   - Table of the 7 layers (External Services, System Items, AI/Automation, Integrations, Access Control, Entry Points, Data + Platform) with node counts and accent colors

5. **Layout & Rendering Logic**
   - Horizontal column layout, node dimensions (190×120), gaps, column wrapping
   - Header nodes vs regular nodes
   - Edge styling, animated flows, hover-to-reveal interaction

6. **Backend / Edge Functions Integration**
   - How the panel surfaces 214+ Supabase edge functions
   - Caller resolution (`getCallersFor`)
   - Logs deep-link to Supabase dashboard
   - Triggers: manual / cron / webhook

7. **Workflow States Legend**
   - DRAFT, REVIEW, APPROVED, QUEUED, PROCESSING, COMPLETE, FAILED, RETRY, DEAD LETTER

8. **Tests & Integrity Guards**
   - `architectureFlow.test.ts` (layout invariants, query matching)
   - `architectureGraphData.test.ts` (no duplicate IDs, valid edge refs, valid layer keys)

9. **Debugging Playbook**
   - Common issues: missing nodes (check layer key), broken edges (orphan source/target), overflow columns, search not matching (check label/hint), edge function not appearing in panel (registry entry missing)
   - Where to look for each symptom (file + function)

## Implementation

- Use ReportLab (Python) following the `skill/pdf` guide
- Read all 5 architecture files in full to extract accurate code references
- Use ASCII-only content (no Persian/emoji) to avoid font-box rendering issues
- Use `Paragraph` wrapping in tables; explicit column widths
- QA: convert each page to JPEG with `pdftoppm -r 150` and visually inspect every page; fix overflow/clipping before delivery
- Output: `/mnt/documents/System_Architecture_Module.pdf` + `<lov-artifact>` tag

No code changes to the project.
