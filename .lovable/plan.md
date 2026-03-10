

# Fix: Remnant Dialog Not Completing the Run

## Problem
When operator clicks "Save Remnant to Waste Bank" or "Discard as Scrap", the dialog closes but `handleCompleteRun` is never re-invoked. The run stays stuck — remnant acknowledged but never completed.

## Root Cause
Line 505-512: `handleCompleteRun` returns early to show the remnant prompt. The dialog button handlers (lines 931-946) close the dialog but never call `handleCompleteRun()` again. Since `setState` is async, simply calling it after closing won't work — the function would see stale state and show the prompt again.

## Fix in `CutterStationView.tsx`

1. **Add a `useRef`** to track remnant decision:
   ```typescript
   const remnantDecisionRef = useRef<"save" | "discard" | null>(null);
   ```

2. **Update `handleCompleteRun`** (line 505): Check the ref to skip the prompt when already acknowledged:
   ```typescript
   if (avgRemnant > 0 && !remnantDecisionRef.current) {
     // show prompt and return early (existing logic)
   }
   ```

3. **Update remnant data passed to `complete-run`** (line 523-524): Use the ref decision instead of just threshold:
   ```typescript
   remnantLengthMm: remnantDecisionRef.current === "save" && avgRemnant >= REMNANT_THRESHOLD_MM ? avgRemnant : undefined,
   remnantBarCode: remnantDecisionRef.current === "save" && avgRemnant >= REMNANT_THRESHOLD_MM ? currentItem.bar_code : undefined,
   ```

4. **Update "Save Remnant" button** (line 931-934): Set ref, close dialog, re-call completion:
   ```typescript
   onClick={() => {
     remnantDecisionRef.current = "save";
     setRemnantPromptOpen(false);
     setRemnantInfo(null);
     handleCompleteRun(); // re-invoke — ref check will skip prompt
   }}
   ```

5. **Update "Discard as Scrap" button** (line 944-947): Same pattern with `"discard"`.

6. **Reset ref** on run reset (line 558, alongside existing cleanup):
   ```typescript
   remnantDecisionRef.current = null;
   ```

7. **Add `useRef` to import** (line 1).

One file changed: `src/components/shopfloor/CutterStationView.tsx`.

