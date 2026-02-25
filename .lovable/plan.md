
## Auto-redirect Tablet Users to Shop Floor

### Problem
After login, tablet users land on the general "Select Interface" dashboard (`/home`) and must manually navigate to the Shop Floor. This adds an unnecessary step for shop floor operators who exclusively use tablets.

### Solution
Add a `useEffect` in `src/pages/Home.tsx` that detects tablet-sized viewports (width <= 1024px) and automatically redirects to `/shop-floor`. This uses the existing `useMediaQuery` hook already in the project.

### Changes

**File: `src/pages/Home.tsx`**
- Import the existing `useMediaQuery` hook from `@/hooks/useMediaQuery`
- Add a `useEffect` that checks if the viewport matches tablet size (`(max-width: 1024px)`) and navigates to `/shop-floor` using the existing `useNavigate` hook
- The redirect happens only on initial render, so desktop users resizing their window are not affected unexpectedly

### Technical Details

The redirect logic:
```text
User lands on /home
  -> useMediaQuery("(max-width: 1024px)") returns true?
     -> Yes: navigate("/shop-floor", { replace: true })
     -> No: render normal Home page
```

- The `useMediaQuery` hook already exists at `src/hooks/useMediaQuery.ts`
- Uses `replace: true` so the user cannot "back" into the home page
- No database changes required
- No new dependencies
