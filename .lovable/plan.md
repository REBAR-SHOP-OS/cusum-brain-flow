

# Audit: Make Live Monitor Shop-Floor Focused

## Issues Found

The Live Monitor currently has 3 CEO-level items that don't belong:

| Item | Problem | Action |
|------|---------|--------|
| **Team Active** (PulseStrip) | HR metric, not shop ops | Remove |
| **Visitors** (PulseStrip) | Website/CRM metric | Remove |
| **Leads Today** (PulseStrip) | Sales metric | Remove |
| **Cash Position** (SLAAlertStrip) | Financial metric (Receivables/Payables) | Remove |

Two existing shop-floor components are available but **not wired in**:
- `MaterialFlowDiagram` — phase pipeline (Queued → Cut → Bend → QC → Dispatch)
- `DowntimeAlertBanner` — alerts for machines down or idle 30+ min

## Changes to `src/components/office/LiveMonitorView.tsx`

### Remove
1. **PulseStrip**: Remove "Team Active", "Visitors", "Leads Today" items (lines 96-119). Grid changes from `grid-cols-6` to `grid-cols-3`.
2. **SLAAlertStrip**: Remove "Cash Position" panel (lines 367-387). Grid changes from `grid-cols-3` to `grid-cols-2`.

### Add
3. **DowntimeAlertBanner** — render right after PulseStrip (before machine cards) to surface down/idle machines prominently.
4. **MaterialFlowDiagram** — render between machine cards and SLAAlertStrip to show the production phase pipeline.

### Final Layout
```text
Hero Banner (Tonnage + Pieces)
├── PulseStrip: Machines | Tonnage | PCS Cut (3 cards only)
├── DowntimeAlertBanner (red/amber alerts for down/idle machines)
├── Machine Cards (horizontal scroll)
├── MaterialFlowDiagram (phase pipeline)
├── SLAAlertStrip: Throughput | Utilization (2 cards only)
├── Production Ledger + Clearances + Activity Feed
```

Single file edit. No database changes.

