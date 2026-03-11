

## Fix: Block Past Dates in "Set Date" & Translate Remaining Persian Text

### Problem
1. The "Set Date" popover (`DateSchedulePopover`) allows setting a past date with no validation. This causes posts to appear on past days in the calendar (e.g., showing on Mar 10 when today is Mar 11).
2. Line 686 in `PostReviewPanel.tsx` still has Persian text in the toast message.

### Changes

**`src/components/social/PostReviewPanel.tsx`**

1. **`DateSchedulePopover` (line 118)** — Disable past dates in the Calendar component:
   ```typescript
   disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
   ```

2. **`handleSetDate` (line 110)** — Add past-time validation before calling `onSetDate`:
   ```typescript
   const handleSetDate = () => {
     const d = new Date(selectedDate);
     d.setHours(parseInt(hour), parseInt(minute), 0, 0);
     if (d <= new Date()) {
       // Don't call onSetDate — parent will not save
       return; // caller shows no toast, but date simply won't set
     }
     onSetDate(d);
   };
   ```
   We need to pass a toast function or return a boolean to show an error. Simplest: accept `useToast` in the component and show error there.

3. **Line 686** — Replace Persian toast with English:
   ```typescript
   toast({ title: "Invalid Time", description: "Cannot schedule in the past. Please select a future time.", variant: "destructive" });
   ```

4. **`onSetDate` handler (line 497)** — Add a server-side guard as backup: reject if `date <= new Date()`.

