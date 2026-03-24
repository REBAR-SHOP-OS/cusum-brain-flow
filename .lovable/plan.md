

## Hide Floating Chat Button on Team Hub Page

### Problem
The floating teal chat button (DockChatBar) is redundant on the Team Hub page since the user is already in the full chat interface.

### Changes

**File**: `src/components/chat/DockChatBar.tsx`
- Import `useLocation` from `react-router-dom`
- At the top of the component, check if current path is `/team-hub`
- If on Team Hub, return `null` (hide the entire floating button and dock)

```tsx
const location = useLocation();
if (location.pathname === "/team-hub") return null;
```

| File | Change |
|---|---|
| `src/components/chat/DockChatBar.tsx` | Hide component on `/team-hub` route |

