

# Per-User Agent Floating Button

## What Changes

The floating button currently shows Vizzy for everyone. Instead, each user will see their **own assigned agent**:

| User | Sees | Avatar |
|------|------|--------|
| Sattar (CEO) | Vizzy | assistant-helper.png |
| Vicky (Accountant) | Penny | accounting-helper.png |
| Kourosh (Shop) | Forge | shopfloor-helper.png |
| Saurabh/Neel (Sales) | Blitz | sales-helper.png |
| Radin (AI Manager) | Relay (Haven) | support-helper.png |
| Ben (Estimator) | Gauge | estimating-helper.png |
| Josh (Operations) | Vizzy | assistant-helper.png |
| Unknown users | Vizzy (default) | assistant-helper.png |

## File Changes

### 1. `src/components/vizzy/FloatingVizzyButton.tsx`

- Import `useAuth` and `getUserPrimaryAgent` (from `userAgentMap`)
- Get the logged-in user's email, look up their assigned agent via `getUserPrimaryAgent(email)`
- Use the agent's `image` for the avatar instead of the hardcoded `vizzy-avatar.png`
- Fall back to `assistant-helper.png` (Vizzy) if no mapping exists
- Remove the `vizzy-avatar.png` import (no longer needed)

### 2. `src/assets/vizzy-avatar.png`

- No longer used by the floating button (can be kept for other uses, but the button will use agent-specific images from `src/assets/helpers/`)

### 3. No other file changes needed

`AppLayout.tsx` and `LiveChatWidget.tsx` remain untouched -- the button already renders for all users and the chat toggle event works as-is.

## Technical Detail

```text
FloatingVizzyButton
  |
  +--> useAuth() --> user.email
  |
  +--> getUserPrimaryAgent(email) --> AgentConfig { name, image, ... }
  |
  +--> Render agent.image as avatar (fallback: assistantHelper)
  +--> aria-label: "Open {agent.name} AI Assistant"
```

