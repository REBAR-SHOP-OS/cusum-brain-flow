

# Fix Floating Vizzy Button: Visible to All Users + Fix Avatar

## Changes

### 1. `src/components/vizzy/FloatingVizzyButton.tsx`

- **Remove the `useSuperAdmin` guard** — delete the import of `useSuperAdmin`, the `isSuperAdmin` check, and the `if (!isSuperAdmin) return null;` line. The button will render for every logged-in user.
- **Use the correct Vizzy avatar image** — the current `src/assets/vizzy-avatar.png` file will be replaced with the actual uploaded Vizzy character image (the one with glasses, teal glow from the screenshot). The import path stays the same.

### 2. `src/components/layout/LiveChatWidget.tsx`

- No changes needed — it already works for all users via the `toggle-live-chat` event.

### 3. `src/components/layout/AppLayout.tsx`

- No changes needed — it already renders `FloatingVizzyButton` unconditionally.

## Technical Summary

| File | Change |
|------|--------|
| `src/components/vizzy/FloatingVizzyButton.tsx` | Remove `useSuperAdmin` import and guard. All users see the button. |
| `src/assets/vizzy-avatar.png` | Replace with the correct Vizzy character image from the user's upload |

The button keeps its teal pulsing ring, hover scale effect, green status dot, and mobile-aware positioning. The only difference is it now shows for everyone.
