

## Plan: Preserve SEO Section State on Navigation

### Problem
When navigating between Dashboard, Keywords, Pages, etc., the current section unmounts completely (conditional rendering with `&&`). Returning to a section forces a full re-render and data refetch, losing scroll position and any local state.

### Fix
**File: `src/pages/SeoModule.tsx`**

Replace conditional rendering (`{section === "overview" && <SeoOverview />}`) with CSS visibility (`display: none` / `display: block`). All traffic sub-sections render once and stay mounted — only the active one is visible.

```tsx
// Before (unmounts on navigate):
{section === "overview" && <SeoOverview />}

// After (stays mounted, hidden via CSS):
<div style={{ display: section === "overview" ? "block" : "none" }}>
  <SeoOverview />
</div>
```

Same pattern for all 6 traffic sections (overview, keywords, pages, tasks, links, copilot) and the 4 category sections (traffic, content, ai-pr, ai-visibility, local).

### Result
- Data stays loaded when switching between sections
- No re-fetch on return
- Scroll position preserved
- React Query cache still works for background refreshes

