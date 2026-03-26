

# Navigate to Home After Successful Schedule in Ad Director

## Problem
After clicking "Confirm Schedule" in the Ad Director video editor and getting a success toast, the user stays on the editor page. They want to be redirected to `/home` automatically.

## Fix
**File: `src/components/ad-director/ProVideoEditor.tsx`**

In the `SchedulePopover` component (around line 109-113), after the success toast and `setOpen(false)`:

1. Import `useNavigate` from `react-router-dom`
2. Add `const navigate = useNavigate()` inside `SchedulePopover`
3. After the success toast (line 112), add a short delay then navigate to `/home`:
```tsx
toast({ title: "Scheduled ✅", ... });
setOpen(false);
setTimeout(() => navigate("/home"), 1200);
```

The 1.2s delay lets the user see the success toast before navigating away.

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — add `useNavigate`, navigate to `/home` after successful schedule

