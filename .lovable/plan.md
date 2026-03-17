

# Fix: Restore AI Token Usage Card to CEO Dashboard

## Problem
During the last round of edits to `CEODashboardView.tsx`, the `AITokenUsageCard` import and rendering were accidentally removed. The component file (`src/components/ceo/AITokenUsageCard.tsx`) is intact — it just needs to be wired back in.

## Fix
1. **Add the import** back to `CEODashboardView.tsx`:
   ```ts
   import { AITokenUsageCard } from "@/components/ceo/AITokenUsageCard";
   ```
2. **Render `<AITokenUsageCard />`** in the dashboard layout — placed after the existing sections (pipeline chart area or bottom of the dashboard grid), matching its original position.

Single-file change, no database or backend work needed.

