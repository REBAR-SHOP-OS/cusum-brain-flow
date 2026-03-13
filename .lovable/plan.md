

# Fix Duplicate Notifications on Team Chat Messages

## Root Cause

`useNotifications()` is called in **4 separate components** simultaneously:
- `AppSidebar` 
- `TopBar`
- `Sidebar`
- `InboxPanel`

Each instance creates its own Supabase realtime subscription on the `notifications` table. When a new notification INSERT arrives, **all 4 instances** independently fire:
1. `playMockingjayWhistle()` — sound plays 3-4x
2. `showBrowserNotification()` — browser notification appears 3-4x  
3. `toast()` or `dispatchEvent("team-chat-incoming")` — toast/chat popup fires 3-4x
4. `setNotifications(prev => [...])` — each adds the same notification to its own state

The channel name `notifications-realtime-${userId}` is the same across instances, but Supabase client still delivers events to each `.on()` callback registered.

## Solution

Add a **global deduplication guard** using a module-level `Set` that tracks recently processed notification IDs. When an INSERT event fires, check if the ID was already processed within the last 5 seconds. Only the first instance to process it will trigger side effects (sound, toast, browser notification).

### File: `src/hooks/useNotifications.ts`

Add at module level (outside the hook):
```typescript
const processedIds = new Set<string>();
function shouldProcess(id: string): boolean {
  if (processedIds.has(id)) return false;
  processedIds.add(id);
  setTimeout(() => processedIds.delete(id), 5000);
  return true;
}
```

Then wrap the INSERT handler's side effects:
```typescript
if (payload.eventType === "INSERT") {
  const newRow = payload.new as any;
  // All instances update state (for consistent unread counts)
  setNotifications((prev) => {
    if (prev.some(n => n.id === newRow.id)) return prev;
    return [mapRow(newRow), ...prev];
  });
  
  // Only first instance triggers side effects
  if (!shouldProcess(newRow.id)) return;
  
  playMockingjayWhistle();
  showBrowserNotification(...);
  // toast or dispatchEvent...
}
```

This ensures:
- State updates happen in all hook instances (so unread counts stay correct)
- Sound, browser notification, and toast fire exactly **once** per notification

