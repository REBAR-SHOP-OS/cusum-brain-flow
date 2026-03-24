

## Filter Forward Message Dialog to rebar.shop Channels Only

### Problem
The Forward Message dialog currently shows all channels including DM conversations. Per the Team Hub governance rules, only official channels and groups (rebar.shop team channels) should be visible — DMs should be excluded, consistent with the sidebar which already hides DMs.

### Changes

**File**: `src/components/teamhub/ForwardMessageDialog.tsx`

1. Filter out DM-type channels from the list — only show channels with `channel_type === "channel"` or `channel_type === "group"` (exclude `"dm"`)
2. This aligns with the sidebar behavior where DMs are already hidden

Update line 30-32:
```typescript
const filteredChannels = channels
  .filter((c) => c.id !== currentChannelId)
  .filter((c) => c.channel_type !== "dm")  // Only show channels/groups, not DMs
  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
```

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ForwardMessageDialog.tsx` | Add `channel_type !== "dm"` filter to exclude DM channels |

