

## Plan: Make Back Button Return to History Panel

### Problem
When a user opens a session from the History panel in AI Extract, clicking the sidebar "Back" button navigates away from the Office portal entirely (browser history back). The user expects it to return to the History session list they came from.

### Approach
Pass the `showHistory` state toggle from `AIExtractView` up through `OfficePortal` to `OfficeSidebar`. When the user is viewing an active session in AI Extract, the Back button shows the history panel. Otherwise, it navigates back normally.

### Changes

**1. `src/components/office/OfficeSidebar.tsx`**
- Add optional `onBack` callback prop
- If `onBack` is provided, call it instead of `navigate(-1)`
- Fall back to `navigate(-1)` when `onBack` is not set

**2. `src/components/office/AIExtractView.tsx`**
- Expose a callback (via ref or prop) that the parent can call to toggle history open
- Accept an `onRegisterBack` or use a ref pattern so OfficePortal can wire the back button

**3. `src/pages/OfficePortal.tsx`**
- Track whether AI Extract has an active session
- Pass an `onBack` handler to the sidebar that, when on `ai-extract` with an active session, toggles the history panel; otherwise uses `navigate(-1)`

### Simpler Alternative
Instead of complex state wiring, the Back button behavior can be:
- When `activeSection === "ai-extract"`: call a callback that AIExtractView exposes to show history and clear the active session
- Otherwise: `navigate(-1)`

This keeps it simple — one optional `onBack` prop on the sidebar.

### Files
| File | Change |
|---|---|
| `src/components/office/OfficeSidebar.tsx` | Add `onBack?: () => void` prop, use it if provided |
| `src/components/office/AIExtractView.tsx` | Accept `onBackToHistory` ref/callback to expose history toggle |
| `src/pages/OfficePortal.tsx` | Wire the back-to-history callback between AIExtractView and sidebar |

### Result
Clicking "Back" while viewing a session in AI Extract opens the History panel instead of leaving the page. On other sections, Back still navigates to the previous page.

