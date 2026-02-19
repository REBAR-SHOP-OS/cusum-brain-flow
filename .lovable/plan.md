
# Show Screenshot Button Only for @rebar.shop Users

## Current Situation

`ScreenshotFeedbackButton` (the camera icon) is currently rendered for **all users** — including external customers and other non-internal users — because `AppLayout.tsx` renders it unconditionally with no email/role guard.

## Fix — One File Only: `src/components/layout/AppLayout.tsx`

### Steps

1. Import `useAuth` (already used elsewhere in the app)
2. Read `user?.email` from auth
3. Compute `const isInternal = (user?.email ?? "").endsWith("@rebar.shop")`
4. Conditionally render `<ScreenshotFeedbackButton />` only when `isInternal` is true

### Result

```tsx
// Inside AppLayout:
const { user } = useAuth();
const isInternal = (user?.email ?? "").endsWith("@rebar.shop");

// In JSX:
{isInternal && <ScreenshotFeedbackButton />}
```

This mirrors the exact same logic already used in `RoleGuard.tsx` (line 56).

## Scope

| File | Change |
|---|---|
| `src/components/layout/AppLayout.tsx` | Import `useAuth`, derive `isInternal`, wrap `<ScreenshotFeedbackButton />` with `{isInternal && ...}` |

No other files are touched. The `ScreenshotFeedbackButton` component itself is unchanged.
