
# Fix Chat Freezing During Write Action Confirmation

## Problem
When the AI needs to execute a write action (like updating a WordPress page), it shows a confirmation card with Approve/Cancel buttons. However, the text input remains active, so users type "yes" or "ok" instead of clicking Approve. This:
1. Sends a new chat message, clearing the pending action
2. The AI calls the same tools again, showing "Checking pages..." in a loop
3. The chat appears frozen/stuck in an endless cycle

## Solution
Disable the text input and send button whenever a pending action is awaiting confirmation, and show a helpful placeholder message.

## Changes

### 1. `src/components/website/WebsiteChat.tsx`
- Change the textarea `disabled` prop from `isStreaming` to `isStreaming || !!pendingAction`
- Change the placeholder text to `"Approve or cancel the action above..."` when `pendingAction` is set
- Disable the Send button when `pendingAction` is present
- Block `handleSend` if `pendingAction` is set

### 2. `src/components/layout/LiveChatWidget.tsx`
- Apply the same fix: disable textarea and send when `pendingAction` is present
- Destructure `pendingAction` from `useAdminChat` (currently not used in this component)
- Show the pending action confirmation card (currently missing from LiveChatWidget entirely)

## Technical Details

**WebsiteChat.tsx** (3 small edits):
- Line 50 (`handleSend`): Add `|| pendingAction` to the early return guard
- Line 188-190: Change placeholder and disabled prop to include `pendingAction`
- Line 197: Add `|| !!pendingAction` to send button disabled state

**LiveChatWidget.tsx** (3 small edits):
- Destructure `pendingAction`, `confirmAction`, `cancelAction` from `useAdminChat()`
- Disable textarea when `pendingAction` is set
- Add a minimal pending action confirmation UI (similar to WebsiteChat)
