
# Fix: Screenshot Button Missing in Office Tools

## Problem
The `/office` route is the only protected route that bypasses `AppLayout` — it uses its own standalone layout. Since `ScreenshotFeedbackButton` is rendered inside `AppLayout`, it does not appear on the Office Tools page.

## Solution
Add `ScreenshotFeedbackButton` directly to `src/pages/OfficePortal.tsx` for all `@rebar.shop` users.

## Technical Details

**File: `src/pages/OfficePortal.tsx`**

1. Import `ScreenshotFeedbackButton` and `useAuth`
2. Check if the current user's email ends with `@rebar.shop`
3. Render `<ScreenshotFeedbackButton />` at the bottom of the component JSX (same pattern as `AppLayout`)

```text
// Add imports
import { ScreenshotFeedbackButton } from "@/components/feedback/ScreenshotFeedbackButton";
import { useAuth } from "@/lib/auth";

// Inside component, after existing hooks:
const { user } = useAuth();
const isRebarUser = (user?.email ?? "").endsWith("@rebar.shop");

// At end of returned JSX, before closing </div>:
{isRebarUser && <ScreenshotFeedbackButton />}
```

This is a single-file change with no side effects.
