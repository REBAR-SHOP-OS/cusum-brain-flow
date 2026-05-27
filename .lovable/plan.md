## Add search box to Loading Station

Add a search input on the Loading Station bundle-selection screen so operators can quickly filter the 157-bundle list by project, customer, or barlist name.

### Scope
- Page: `src/pages/LoadingStation.tsx` (bundle-selection view only — the per-bundle checklist view is untouched).
- Filter is client-side over the already-loaded `bundles` array from `useCompletedBundles()`. No DB or hook changes.

### Changes

1. **`src/pages/LoadingStation.tsx`**
   - Add `const [bundleQuery, setBundleQuery] = useState("")`.
   - Compute `filteredBundles` by case-insensitive match on `customerName`, `projectDisplayName`, `projectName`, and `barlistName` (whichever exist on the bundle row).
   - Render a search input in the toolbar row that currently shows "Select Bundle to Load · 157", aligned right (matches the red-circled area in the screenshot). Use existing `Input` + `Search` icon from lucide-react to stay consistent with shop-floor styling (industrial dark theme, semantic tokens only).
   - Pass `filteredBundles` to `<ReadyBundleList />` instead of `bundles`. Count badge reflects the filtered length.
   - Empty-filter state: show a small "No bundles match '<query>'" message instead of the list.

### Out of scope
- No changes to `ReadyBundleList`, `useCompletedBundles`, or the per-bundle checklist view.
- No server-side search, no debounce (list is already in memory).
- No new tabs / archive surfaces.

### Verification
- Open `/shopfloor/loading`, type a project or customer fragment → list narrows live, count badge updates, clearing the box restores all bundles.
