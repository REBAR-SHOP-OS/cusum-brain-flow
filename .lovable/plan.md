

## Plan: Fix Back Button in Office Portal

### Problem
The "Back" button in the Office sidebar uses `navigate(-1)` / `window.history.back()`, which fails when there's no previous history entry (e.g., user navigated directly to `/office` or opened it in a new tab).

### Solution
Replace the history-based back navigation with an explicit route. The Back button should navigate to `/home` (the main dashboard) as a reliable fallback destination.

### Changes

| File | Change |
|------|--------|
| `src/pages/OfficePortal.tsx` | In `handleBack`, replace `window.history.back()` with `navigate("/home")` (add `useNavigate`) |
| `src/components/office/OfficeSidebar.tsx` | In `handleBack`, replace `navigate(-1)` with `navigate("/home")` as fallback |

### What does NOT change
- AI Extract internal back-to-history logic stays intact
- Sidebar layout, styling — untouched
- No database changes

