

# Fix: Supervisor Override + Add DTX 600 to Machine Registry

## What Changes

### 1. Add "GENSCO DTX 600" to machine registry
From the uploaded PDF spec sheet, DTX 600 ("The Rebar King") capacities mapped to Canadian metric sizes:

```text
DTX 600 Capacity (from PDF):
  10M (#3): 25    15M (#5): 16    20M (#6): 12
  25M (#8): 6     30M (#10): 5    35M (#11): 4
  45M (#14): 2    55M (#18): 1
```

**File:** `src/components/shopfloor/machineRegistry.ts`
- Add `"GENSCO DTX 600"` entry with the above capacities, maxBarCode `"55M"`, no blocked sizes, reuse `dtx400.png` image until a dedicated DTX 600 image is provided.
- Update DTX 400 capacities to match PDF exactly: `10M: 14, 15M: 12, 20M: 8, 25M: 6, 30M: 2, 35M: 1` (current has 30M: 4 which doesn't match PDF).

### 2. CutEngine.tsx — Supervisor override with GPS-style warning
- Add `isSupervisor: boolean` prop.
- **Up button**: Supervisors can go past `maxBars` (absolute cap: 99). Operators remain capped at `maxBars`.
- **Warning zone**: When `bars > maxBars`, show amber warning box:
  ```
  ⚠ OVER CAPACITY — Machine rated for {maxBars}
  Supervisor override: {bars} bars
  ```
  Amber border + pulsing icon on the bars counter area.
- **canStart**: Remove `bars <= maxBars` condition — supervisors can start above capacity.
- **Suggestion sync**: Keep `Math.min(...)` for suggestions but don't enforce it on manual changes.

### 3. CutterStationView.tsx — Pass supervisor flag, remove clamp
- Pass `isSupervisor={isAdmin || isShopSupervisor}` to `CutEngine`.
- In `handleLockAndStart` (line 269): Remove `const clampedBars = Math.min(bars, maxBars)` — use `bars` directly. Replace all `clampedBars` references with `bars`.

## Files Modified
- `src/components/shopfloor/machineRegistry.ts` — add DTX 600, fix DTX 400 numbers
- `src/components/shopfloor/CutEngine.tsx` — supervisor override + warning UI
- `src/components/shopfloor/CutterStationView.tsx` — pass `isSupervisor`, remove clamp

