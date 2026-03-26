

# Add Circular Home Button to Result View

## What
Add a circular home icon button below the "Approve & Download" and "Edit Video" buttons in the result view, allowing users to navigate back to the idle/initial state of AI Video Director.

## Change

### `src/components/ad-director/AdDirectorContent.tsx`
- After the action buttons `div` (line 416), add a new centered row with a circular `Home` icon button
- On click, reset the service state back to idle: `service.patchState({ flowState: "idle" })`
- Style: circular button (`rounded-full w-12 h-12`), subtle background, with a `Home` icon from lucide-react

```tsx
{/* Home button */}
<div className="flex justify-center pt-2">
  <button
    onClick={() => service.patchState({ flowState: "idle" })}
    className="w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
    title="Back to AI Video Director"
  >
    <Home className="w-5 h-5 text-primary" />
  </button>
</div>
```

- Ensure `Home` is imported from `lucide-react` at the top of the file

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Add circular Home button after action buttons, import `Home` icon |

