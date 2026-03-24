

## Filter Forward Dialog to Only Official Channel, Official Group & Team Members

### Problem
The Forward Message dialog currently shows all non-DM channels including private groups like "rsic", "management-communication", "management". Per Team Hub governance, only **Official Channel**, **Official Group**, and **team member DMs** should be visible for forwarding.

### Changes

**File**: `src/components/teamhub/ForwardMessageDialog.tsx` (line 30-33)

Update the filter to only allow forwarding to Official Channel and Official Group:

```typescript
const filteredChannels = channels
  .filter((c) => c.id !== currentChannelId)
  .filter((c) => c.name === "Official Channel" || c.name === "Official Group")
  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
```

This strictly limits forwarding destinations to the two official company channels, matching the sidebar governance rules.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ForwardMessageDialog.tsx` | Restrict forward targets to Official Channel & Official Group only |

