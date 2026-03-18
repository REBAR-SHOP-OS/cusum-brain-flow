

## Plan: Fix "Created By" to Show English Fallback and "System" for System Tasks

### Problem
1. The fallback text is in Persian ("ناشناس") — should be English
2. When the system created a task (no human creator), it should say "System" not "Unknown"

### Changes — `src/pages/Tasks.tsx`

**1. Update `getTaskCreatorName` function (lines 34-57)**
- Before returning `null`, check if `task.source` indicates a system origin (e.g., `"system"`, `"email"`, `"feedback"`, or `task.created_by_profile_id` is null)
- If so, return `"System"` instead of `null`

**2. Update fallback text (line 1351)**
- Change `"ناشناس"` to `"Unknown"`

**3. Update any other occurrences in task list cards (~lines 1085-1150)**
- Ensure the same English fallback is used everywhere `getTaskCreatorName` returns null

### Summary
- One file change: `src/pages/Tasks.tsx`
- Replace Persian fallback with English
- Return "System" from `getTaskCreatorName` when there's no human creator profile

