
# Two Fixes: Radin's Agent + Helper Card Subtitle Color

## Fix 1: radin@rebar.shop — Wrong Agent & Hero Text

**File:** `src/lib/userAgentMap.ts`

The mapping for `radin@rebar.shop` currently has:
- `agentKey: "support"` → routes to Haven (wrong)
- `heroText: "How can **Relay** assist you today?"` → shows "Relay" in the hero (wrong)

The correct agent for Radin is **Pixel** (Social Media). Changes needed:

- `agentKey: "support"` → `agentKey: "social"`
- `heroText` → `"How can **Pixel** assist you today?"`

**File:** `src/pages/Home.tsx`

The `agentKeyToSuggestion` map (line 43) already has `assistant`, `accounting`, `shopfloor`, `sales`, `estimating`, `support`, `email` — but is missing `"social"`. Need to add:
```ts
social: { code: "pixel", name: "Pixel" },
```

Also the `ChatInput` placeholder (line 154) has a hardcoded conditional that only handles `assistant`, `shopfloor`, and falls back to `gauge`. Need to make it aware of `social` → show "Ask Pixel anything..."

---

## Fix 2: Helper Card Subtitle (Role) Color Visibility

**File:** `src/pages/Home.tsx` — `HelperCard` component (line 237)

Current desktop role text: `sm:text-muted-foreground`

`text-muted-foreground` uses the CSS variable `--muted-foreground` which in many themes resolves to a very light gray, making it hard to read against a white/light card background.

**Fix:** Change to `sm:text-foreground/60` — this uses the primary foreground color at 60% opacity, which is always readable regardless of the active theme (light or dark).

No other parts of the app are touched.

---

## Technical Summary

| File | Line(s) | Change |
|---|---|---|
| `src/lib/userAgentMap.ts` | 56–58 | `agentKey: "social"`, update heroText to Pixel |
| `src/pages/Home.tsx` | 43–51 | Add `social: { code: "pixel", name: "Pixel" }` to map |
| `src/pages/Home.tsx` | 154 | Fix placeholder to handle "social" agentKey |
| `src/pages/Home.tsx` | 237 | `sm:text-muted-foreground` → `sm:text-foreground/60` |
