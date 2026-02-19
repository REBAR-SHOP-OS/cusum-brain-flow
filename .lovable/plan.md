
# Two Changes: Larger ShopFloor Mic Button + AI User Sidebar Restriction

## Change 1: Larger, Tablet-Optimized Mic Button in VoiceRecorderWidget

### Current Problem
The idle mic button in `src/components/shopfloor/VoiceRecorderWidget.tsx` is a small `w-14 h-14` floating button. On a 10-inch tablet it looks too small and doesn't clearly differentiate between the "start recording", "stop recording", and "listening" states.

### Solution
Redesign the idle FAB (floating action button) to be much larger and explicitly red, with **three distinct visual states**:

| State | Icon | Appearance |
|---|---|---|
| **Idle** (not recording) | `Mic` | Large button, red background, white mic icon, prominent shadow |
| **Listening** (recording active) | `Radio` (animated pulse) | Red pulsing button with "RECORDING" label beneath, clearly different from idle |
| **Stop** | `Square` or `MicOff` | Shown inside the expanded widget card — large "Stop" button |

### Specific Changes to `VoiceRecorderWidget.tsx`
- Idle button: change from `w-14 h-14` → `w-20 h-20 md:w-24 md:h-24` (80px → 96px on tablet)
- Color: always red (`bg-red-600 hover:bg-red-500`) — currently it uses the theme's `bg-primary` which may not be red
- Icon size: increase mic icon from `w-6 h-6` → `w-10 h-10`
- Add a small label beneath the button: `"Tap to record"` in small text
- When **listening**: show a large animated `Radio` or `Mic` icon with a pulsing red ring and a `"Recording..."` label
- The **Stop** button inside the widget card: make it more prominent — full-width, larger text, with `Square` + `MicOff` icon combo
- Add a label `"Tap mic to speak"` beneath the idle FAB for tablet discoverability

### File to edit
- `src/components/shopfloor/VoiceRecorderWidget.tsx`

---

## Change 2: Restrict `ai@rebar.shop` to Dashboard + Shop Floor Only

### Current Problem
`ai@rebar.shop` is treated as a super-admin (in `useSuperAdmin.ts`) and therefore sees the full sidebar with all navigation groups (Office, Production, Logistics, QA, System). There is no email-based sidebar restriction for this account.

### Solution
Add an early-exit check inside `AppSidebar.tsx` for the email `ai@rebar.shop`. When this email is detected, render a **minimal sidebar** with only two items:
- Dashboard (`/home`)
- Shop Floor (`/shop-floor`)

This mirrors the existing pattern already used for external employees (lines 42–104 in `AppSidebar.tsx`).

### File to edit
- `src/components/layout/AppSidebar.tsx`

### Code to add (early-return, before `navGroups` definition)
```typescript
// AI bot account: only Dashboard + Shop Floor
if (email === "ai@rebar.shop") {
  const aiNav = [
    { name: "Dashboard", href: "/home", icon: Home },
    { name: "Shop Floor", href: "/shop-floor", icon: Factory },
  ];
  return (
    <aside ...>
      {/* minimal nav rendering */}
    </aside>
  );
}
```

This is purely a UI restriction — the actual page-level auth on those routes is unchanged.

---

## Technical Summary

### Files Modified
1. `src/components/shopfloor/VoiceRecorderWidget.tsx` — larger red mic FAB, distinct listening/stop icons
2. `src/components/layout/AppSidebar.tsx` — email-based early-exit for `ai@rebar.shop`

### No database changes required
Both changes are purely front-end / UI.
