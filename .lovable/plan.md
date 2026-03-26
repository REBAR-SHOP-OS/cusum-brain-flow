

# Fix Forward Dialog in DockChatBox — Show Only @rebar.shop Members

## Problem
When clicking the forward icon in the DockChatBox popup, it currently shows channels. The user wants it to show only `@rebar.shop` team members instead, matching the screenshot.

## Changes

### `src/components/chat/DockChatBox.tsx`

1. **Import `useOpenDM`** from `@/hooks/useChannelManagement`
2. **Replace `forwardChannels` state + fetch** (lines 458-465) with a filtered list of `@rebar.shop` profiles from the existing `profiles` data (already imported via `useProfiles`)
3. **Update `handleForwardSend`** (lines 352-368): Instead of sending to a channel ID directly, use `openDMMutation.mutateAsync({ targetProfileId })` to find/create the DM channel, then send the forwarded message there
4. **Update the forward popover UI** (lines 689-717): Replace channel list with member list showing avatars + names, filtered to `@rebar.shop` emails only, excluding current user

### Key logic
```typescript
const openDMMutation = useOpenDM();
const forwardMembers = profiles.filter(p => 
  p.email?.endsWith("@rebar.shop") && p.id !== myProfile?.id
);

const handleForwardToMember = async (profileId: string) => {
  const result = await openDMMutation.mutateAsync({ targetProfileId: profileId });
  if (result?.id) {
    await sendMutation.mutateAsync({
      channelId: result.id,
      senderProfileId: myProfile.id,
      text: `↪️ Forwarded from ${forwardMsg.sender?.full_name}:\n${forwardMsg.original_text}`,
      senderLang: myLang,
      targetLangs,
      attachments: forwardMsg.attachments || [],
    });
  }
};
```

