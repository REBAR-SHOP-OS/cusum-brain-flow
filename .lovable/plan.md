

# Hide Kiosk Button for All Users Except ai@rebar.shop

## Change

### File: `src/pages/TimeClock.tsx` (lines 416–418)

Wrap the Kiosk button in a conditional that only renders it when `user?.email === "ai@rebar.shop"`:

```typescript
{user?.email?.toLowerCase() === "ai@rebar.shop" && (
  <Button variant="outline" size="sm" className="gap-1" onClick={enterKioskMode}>
    <Maximize className="w-3.5 h-3.5" /> Kiosk
  </Button>
)}
```

The Face ID toggle (line 411–414) stays visible for all users — only the Kiosk button is hidden.

| File | Change |
|------|--------|
| `src/pages/TimeClock.tsx` | Conditionally render Kiosk button for ai@rebar.shop only |

