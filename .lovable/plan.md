

# Color-Code Event Date Icons: Past (Red) vs Future (Purple)

## Change
In the `EventCard` component, compare each event's date against today's date. Apply a red background to the date icon for past events and a purple background for future/today events.

## Implementation — `src/components/social/ContentStrategyPanel.tsx`

In the `EventCard` function (line ~456):
- Get today's date and build the event date from `event.month` and `event.day` (using current year)
- Compare: if event date < today → red icon; otherwise → purple icon
- Replace the static `bg-muted` class on the date icon `div` (line 463) with the conditional color

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const eventDate = new Date(today.getFullYear(), event.month - 1, event.day);
const isPast = eventDate < today;

// Icon div classes:
// Past:   "bg-red-500/20 text-red-400"
// Future: "bg-purple-500/20 text-purple-400"
```

## Files
- `src/components/social/ContentStrategyPanel.tsx` — `EventCard` component only

