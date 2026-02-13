
# Shop Floor Audit & Improvement Plan

## Issues Found

### Critical Bugs

1. **Pool View requires excessive scrolling** -- 87 "POOL -> CUTTER" items render first, forcing users to scroll through ~30 rows to reach the 9 CLEARANCE and 73 COMPLETE items. On a shop floor tablet, operators will never find them.

2. **Flow diagram phases are not clickable** -- The phase boxes in the flow summary (top bar) look interactive but do nothing when clicked. Operators expect to tap "CLEARANCE (9)" and jump to those items.

3. **No bidirectional navigation between Pool and Stations** -- The plan calls for Pool -> Bender, Bender -> Pool, Cutter -> Pool, Pool -> Cutter navigation. Currently:
   - Pool cards have no action buttons (no "Send to Cutter" or "Send to Bender")
   - Cutter/Bender stations have no "Back to Pool" link
   - MaterialFlowDiagram "View Pool" link exists but individual phase boxes don't navigate

4. **No phase-filtering in Pool View** -- All 169 items are dumped in a single scrollable list. No way to filter by phase, project, or bend type.

### UX / Industrial Quality Issues

5. **Pool cards lack actionable context** -- Cards show progress but no action buttons. In an industrial setting, operators need to:
   - Tap a card to see it on the Cutter or Bender station
   - See which machine an item is assigned to
   - Send items directly to a station queue

6. **No "Send to Bender" button on Pool cards for `cut_done` items** -- Items in the "POOL -> BENDER" phase should have a prominent action to navigate to the bender station.

7. **No "Send to Cutter" button on Pool cards for `queued` items** -- Items waiting in pool should have a way to open the cutter station.

8. **Station views lack "Back to Pool" navigation** -- Cutter and Bender stations have back arrows that go to the Station Dashboard, not the Pool. Operators moving between Pool and stations need a direct link.

---

## Plan

### 1. Add Phase Filter Tabs to Pool View

Add a horizontal tab bar below the flow diagram that filters items by phase. Clicking a phase in the flow diagram also activates that filter.

- Default: "ALL" tab shows everything (current behavior)
- Each phase gets its own tab: POOL->CUTTER | CUTTING | POOL->BENDER | BENDING | CLEARANCE | COMPLETE
- Clicking a flow diagram box activates the corresponding filter tab
- Badge counts on each tab

### 2. Add Action Buttons to Pool Cards

Based on the item's phase, show contextual action buttons:

| Phase | Action Button | Navigates To |
|-------|--------------|--------------|
| `queued` | "Open Cutter" | `/shopfloor/station` (Station Dashboard) |
| `cut_done` | "Open Bender" | `/shopfloor/station` (Station Dashboard) |
| `clearance` | "Review QC" | `/shopfloor/clearance` |
| `complete` | "View Dispatch" | `/deliveries` |

### 3. Add "Back to Pool" Button on Station Headers

Add a "Pool" navigation button to `StationHeader.tsx` that links back to `/shopfloor/pool`. This creates the bidirectional flow:
- Pool -> Cutter (via card action)
- Cutter -> Pool (via header button)
- Pool -> Bender (via card action)
- Bender -> Pool (via header button)

### 4. Make Flow Diagram Boxes Clickable for Filtering

Update the flow diagram in Pool View so clicking a phase box scrolls to / filters that phase section. Add a visual "active" state to the selected box.

### 5. Industrial Polish

- Add a search/filter bar for mark number or bar code
- Show machine assignment badge on cards (if assigned)
- Add a subtle animation when switching filters
- Collapse empty phase sections instead of hiding them (show "0 items" with dimmed styling)

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/PoolView.tsx` | Add phase filter state, clickable flow diagram, action buttons on cards, search input, "Open Cutter/Bender" navigation buttons |
| `src/components/shopfloor/StationHeader.tsx` | Add "Pool" back-link button for bidirectional navigation |
| `src/components/shopfloor/MaterialFlowDiagram.tsx` | Minor: ensure clicking phases navigates to Pool with phase filter query param |

### No New Files Required

All changes are modifications to existing components.

### Pool View Card Actions (Implementation Detail)

```text
Pool Card for phase="queued":
  [Mark: A2005] [BEND] [10M - 1985mm]
  [Progress: 0/2 PCS]
  [======= OPEN CUTTER ========]  <- primary button

Pool Card for phase="cut_done":
  [Mark: A1014] [BEND] [10M - 850mm]
  [Progress: 0/6 PCS]
  [======= OPEN BENDER ========]  <- orange button

Pool Card for phase="clearance":
  [Mark: BS13] [STRAIGHT] [15M]
  [Progress: 0/3 PCS]
  [======== REVIEW QC =========]  <- teal button
```

### Phase Filter State

The filter uses React state with URL search params so the filter persists on refresh and can be deep-linked:
- `/shopfloor/pool` -> shows all
- `/shopfloor/pool?phase=clearance` -> shows only clearance items
- Clicking a flow diagram box sets the search param
