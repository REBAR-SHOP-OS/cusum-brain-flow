

# Fix: Refresh Purchasing List on "New Chat"

## Problem
When the user clicks "New chat" in the purchasing agent, the chat messages clear and the date resets, but the purchasing list items (checkmarks, etc.) don't refresh — the component keeps stale state.

## Solution
In `handleNewChat` in `src/pages/AgentWorkspace.tsx`, after resetting the purchasing date, trigger a re-fetch of the purchasing list. Since `PurchasingListPanel` manages its own data via `usePurchasingList`, the simplest approach is to force the component to fully remount by toggling a key.

### Change in `src/pages/AgentWorkspace.tsx`
1. Add a `purchasingKey` counter state
2. Increment it in `handleNewChat` when `agentId === "purchasing"`
3. Pass `key={purchasingKey}` to `<PurchasingListPanel>` so it fully remounts with fresh state

This ensures all item states (purchased, rejected, etc.) reset cleanly when starting a new chat.

