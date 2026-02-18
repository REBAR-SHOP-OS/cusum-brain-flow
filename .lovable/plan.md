
# Prevent Past Due Dates on Task Creation

## Overview
Add a minimum date restriction to the due date input field so users can only select today or future dates when creating tasks.

## Scope
Only `src/pages/Tasks.tsx` -- no other files change.

## Changes

### 1. Set `min` attribute on the due date input
The date input field (line 514) will get a `min` attribute set to today's date (`YYYY-MM-DD` format). This prevents the browser date picker from allowing past dates.

### 2. Add validation in `createTask` function
Before submitting, if a due date is provided and it is earlier than today, show an error toast and abort creation. This acts as a safety net in case the browser `min` attribute is bypassed.

## Technical Details

### Date input change (line 514)
Add `min={new Date().toISOString().split("T")[0]}` to the Input element.

### Validation in createTask (line 280)
Add a check:
```
if (newDueDate && newDueDate < new Date().toISOString().split("T")[0]) {
  toast.error("Due date cannot be in the past");
  return;
}
```

## Files Modified
1. `src/pages/Tasks.tsx` only
