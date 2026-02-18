
# Remove the SUPPORT Entry from Team Hub Sidebar

## Scope
Only `src/components/teamhub/ChannelSidebar.tsx` is touched. No other file, component, route, logic, or database is changed.

## Exact Changes

### 1. Remove the `openSupportCount` state (line 57)
```ts
// DELETE:
const [openSupportCount, setOpenSupportCount] = useState(0);
```

### 2. Remove the `useEffect` that fetches + subscribes to support_conversations (lines 59–73)
The entire `useEffect` block is deleted.

### 3. Remove the unused `Headphones` import (line 19)
Only `Headphones` is removed from the lucide-react import list.

### 4. Remove the SUPPORT button entry in the DMs list (lines 195–209)
```tsx
{/* SUPPORT entry */}
<button onClick={() => { navigate("/support-inbox"); onClose?.(); }} ...>
  ...orange headphones icon...
  <span>SUPPORT</span>
  {openSupportCount > 0 && <Badge>...</Badge>}
</button>
```
This entire block is deleted.

### 5. Fix the DM badge count (line 190)
The badge currently shows `{dmChannels.length + 1}` (the +1 was for the SUPPORT entry). Change it to `{dmChannels.length}` to accurately reflect actual DM channels.

### 6. Remove the `navigate` import side effect
`useNavigate` was only used for the SUPPORT button's `navigate("/support-inbox")`. If no other usage remains in the file, the `useNavigate` hook and its call are also removed to keep the code clean.

## What Does NOT Change
- All other sidebar items (Channels, Direct Messages, Team Members) remain untouched
- Their order, styling, and behavior are preserved
- No other component, page, hook, or database query is modified
