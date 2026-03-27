

# Restrict Face Memory Button to 3 Specific Users

## Problem
The "Memory" (Brain icon) button on the Face ID Kiosk is currently visible to all users. It must only be visible to: `radin@rebar.shop`, `sattar@rebar.shop`, `neel@rebar.shop`.

## Fix
In `src/pages/TimeClock.tsx` (line ~286), wrap the Memory button in a conditional that checks if `user?.email` is one of the 3 allowed emails. If not, the button is not rendered at all.

```typescript
const MEMORY_ACCESS_EMAILS = ["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"];
const canAccessMemory = MEMORY_ACCESS_EMAILS.includes(user?.email?.toLowerCase() ?? "");
```

Then guard the button and panel:
```tsx
{canAccessMemory && (
  <Button variant="ghost" size="sm" onClick={() => setShowMemoryPanel(true)}>
    <Brain className="w-4 h-4" /> Memory
  </Button>
)}
{canAccessMemory && (
  <FaceMemoryPanel open={showMemoryPanel} onOpenChange={setShowMemoryPanel} />
)}
```

## Files Changed
- **`src/pages/TimeClock.tsx`** — add email whitelist guard around Memory button and FaceMemoryPanel

