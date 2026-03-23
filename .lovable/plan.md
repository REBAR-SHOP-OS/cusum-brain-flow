
Root cause is now clear: the unit UI is still split across two different states.

1. `BarlistMappingPanel` keeps its own local `lengthUnit`
2. `AIExtractView` line items table renders from parent `selectedUnitSystem`
3. The parent only gets updated on `onConfirmMapping(...)`, not when the user clicks the top unit buttons

So today the top toggle can update the preview inside the mapping panel, while the line-items table continues rendering with the older parent value. That is why it still looks “the same”.

Implementation plan

1. Make the unit state single-source-of-truth in `AIExtractView`
- Keep one shared unit state there
- Pass it into `BarlistMappingPanel` as controlled props:
  - `unitSystem`
  - `onUnitSystemChange`
- Remove the panel’s local `lengthUnit` state

2. Update the top toggle to drive the parent immediately
- In `BarlistMappingPanel`, clicking `mm / in / ft / imperial` should call the parent setter directly
- Also update `confirmedUnitRef.current` at the same time so apply/save uses the same latest unit
- Keep the preview table using that shared value so preview and line items always stay synchronized

3. Prevent stale session data from overriding the user’s live choice
- In `AIExtractView`, tighten the session-sync logic so `activeSession.unit_system` only hydrates initial state when a session loads
- After the user changes the unit manually, do not let refresh/load effects silently switch it back to the stored DB value

4. Add the same visible unit control above the line-items section
- Put a compact shared unit switch near the results table header/top area
- Wire it to the exact same parent state
- This makes unit switching available even after mapping is already completed

5. Keep all displays tied to the same formatter
- Continue using `formatLengthByMode(...)` and `lengthUnitLabelByMode(...)`
- Apply the shared unit state consistently to:
  - mapping preview
  - merged rows
  - line items table
  - length header
  - dimensions A, B, C, D, E, F, G, H, J, K, O, R

Files to update
- `src/components/office/AIExtractView.tsx`
- `src/components/office/BarlistMappingPanel.tsx`

Expected result
- Clicking the top unit buttons changes both preview and line items immediately
- Reopening or refreshing the session does not wrongly force the table back to `mm`
- The user can also change units directly from the line-items area
- All views stay perfectly in sync for `mm`, `in`, `ft`, and `imperial`
