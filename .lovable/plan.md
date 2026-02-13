
# Lock Prospect Digging to Ontario, Canada

## Changes

### 1. `src/pages/Prospecting.tsx`
- Change default region from `"Canada/USA"` to `"Ontario, Canada"`
- Remove the region input field from the UI since it should always be Ontario, Canada
- Keep `region` as a constant rather than user-editable state

### 2. `supabase/functions/prospect-leads/index.ts`
- Change the fallback default from `"Canada/USA"` to `"Ontario, Canada"`
- Update the AI system prompt to focus specifically on Ontario cities and contractors

## Technical Details
- The region input field will be removed from the header bar, simplifying the UI
- The edge function will still accept a `region` parameter for future flexibility, but defaults to Ontario
- AI prompt will reference Ontario-specific cities (Toronto, Ottawa, Hamilton, London, etc.)
