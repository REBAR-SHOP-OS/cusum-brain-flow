

# Add Date Picker to Auto-Generate Button

Add a small calendar popover next to the "Auto-generate today" button so you can pick a specific date. When a date is selected, posts will be generated for that date instead of today.

## Changes

### `src/pages/SocialMediaManager.tsx`
- Import `CalendarIcon` from lucide-react, `Popover`/`PopoverTrigger`/`PopoverContent`, and `Calendar` component
- Add `autoGenDate` state (`Date | undefined`)
- Place a small calendar icon button right next to the Auto-generate button, wrapped in a Popover containing the Calendar date picker
- When a date is picked, store it in state and pass it as `scheduledDate` to `generatePosts()`
- Update the button label to show the selected date if one is chosen (e.g., "Auto-generate Mar 14") instead of "Auto-generate today"
- Apply the same pattern to the empty-state Auto-generate button at the bottom

### No other files change
The `useAutoGenerate` hook already accepts `scheduledDate` — we just need to pass it from the UI.

## Files Modified
- `src/pages/SocialMediaManager.tsx`

