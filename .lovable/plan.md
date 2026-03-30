

# Restrict Vizzy Floating Button to sattar@rebar.shop Only

## What
Change the condition that renders `FloatingVizzyButton` so it only appears for `sattar@rebar.shop` — no other user sees it.

## Change

### `src/components/layout/AppLayout.tsx` (line 83-84)
Replace:
```tsx
{isInternal && <FloatingVizzyButton />}
```
With:
```tsx
{user?.email === "sattar@rebar.shop" && <FloatingVizzyButton />}
```

This is the single change needed. The `user` variable is already available in the component via the auth context used to derive `isInternal`.

## Impact
- Only `sattar@rebar.shop` will see the floating Vizzy avatar button
- All other users (including `radin@rebar.shop`, `ai@rebar.shop`, etc.) will not see it
- The `IntelligencePanel` hard block for `ai@rebar.shop` remains intact as a separate layer
- `VizzyCallHandler` remains available to all internal users (phone auto-answer is separate from the UI button)

