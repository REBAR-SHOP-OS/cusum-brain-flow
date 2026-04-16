
## Plan: Auto-Select Detected Unit in Mapping & Line Items

### Problem
Source file is ft-in (correctly detected — DB shows `unit_system="imperial"` for session "test2"), but:
1. The **Mapped Preview header** still says "stored as mm" (old text in user's view)
2. The **unit selector at the bottom** (mm/in/ft/ft-in) defaults to **mm** instead of the detected unit
3. The **Line Items table** displays source-unit values (44.5, 105, 87, 71 inches) labeled as "mm"

The session already has the correct unit (`imperial`/`in`) — frontend just isn't reading and applying it.

### Root Cause
In `BarlistMappingPanel.tsx` line 189: `useState<LengthUnit>("mm")` hardcodes "mm" as the default. The parent component (`AIExtractView.tsx`) and the line items unit toggle don't initialize from `session.unit_system`.

### Changes

**1. `src/components/office/BarlistMappingPanel.tsx`**
- Accept optional `defaultUnit` prop OR sync `localLengthUnit` from `session.unit_system` via `useEffect`
- When parent doesn't provide `controlledUnit`, initialize from session-detected unit instead of hardcoded "mm"
- Map session values → selector values: `imperial`→`imperial`, `in`→`in`, `ft`→`ft`, `mm`/`metric`→`mm`

**2. `src/components/office/AIExtractView.tsx`**
- Pass session's `unit_system` to `BarlistMappingPanel` as the initial/controlled `unitSystem`
- Pass same value to the Line Items unit toggle so the table loads showing the correct unit by default (not mm)

**3. Line Items unit toggle (mm/in/ft/ft-in buttons)**
- Locate the component (likely `AIExtractView.tsx` or a child) and initialize selected unit from `session.unit_system` instead of "mm"

### What stays the same
- Backend detection logic — already correct
- Storage — values stored as source units, no conversion
- DB `unit_system` field — already correctly populated

### Result
When user opens the test2 session, both the Mapped Preview and the Line Items table will show "ft-in" selected by default, with the label reading "(source: ft-in → stored as ft-in)" and lengths displayed as inches (e.g. `105"` instead of `105mm`).
