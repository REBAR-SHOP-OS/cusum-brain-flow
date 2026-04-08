

# Move "Analyze Now" to All Tab Only & Generate Company-Wide Report

## Problem
The "Analyze Now" button is always visible in the header. The user wants it **only on the "All" tab** and when clicked it should generate a comprehensive company-wide report aggregating all employees' activities.

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`

**Move button conditionally**: Wrap the "Analyze Now" button render with `!selectedProfileId` so it only shows when "All" tab is active.

```tsx
{!selectedProfileId && (
  <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !hasCompanyContext} className="gap-1">
    {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
    {analyzing ? "Analyzing..." : "Analyze Now"}
  </Button>
)}
```

This is a single conditional wrapper around the existing button at line ~1299. No other changes needed — the `analyzeSystem` function already performs a full system analysis via the agent, which collects data across all employees.

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Conditionally render "Analyze Now" only when `selectedProfileId` is null (All tab) |

One line change, one file.

