

## Filter Pages by Selected Platform

### Problem
Currently `PAGES_OPTIONS` is a single hardcoded list showing all pages regardless of platform. The user wants each platform to show only its own accounts/pages.

### Solution
Replace the flat `PAGES_OPTIONS` with a platform-to-pages mapping, then compute the filtered pages list based on `localPlatforms`.

### Changes in `src/components/social/PostReviewPanel.tsx`

1. **Replace `PAGES_OPTIONS` with a platform-keyed map:**
```typescript
const PLATFORM_PAGES: Record<string, SelectionOption[]> = {
  facebook: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Steels", label: "Ontario Steels" },
  ],
  instagram: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
  ],
  instagram_fb: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
  ],
  linkedin: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
  ],
  linkedin_org: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  youtube: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  tiktok: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
};
```

2. **Compute filtered pages** inside the component based on `localPlatforms`:
```typescript
const filteredPageOptions = useMemo(() => {
  const seen = new Set<string>();
  return localPlatforms.flatMap(p => PLATFORM_PAGES[p] || []).filter(o => {
    if (seen.has(o.value)) return false;
    seen.add(o.value);
    return true;
  });
}, [localPlatforms]);
```

3. **Pass `filteredPageOptions`** instead of `PAGES_OPTIONS` to the pages `SelectionSubPanel`.

4. **Reset `localPages`** when platforms change (in `handlePlatformsSaveMulti`) to avoid stale page selections.

Since the exact accounts per platform aren't stored in a database table yet, I need the user to confirm the mapping. Let me ask.

