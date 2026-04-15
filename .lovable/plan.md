

## Plan: Enable "Business Tasks" Menu for ben@rebar.shop

### Change
Add `"Business Tasks"` to Ben's menu list in `src/lib/userAccessConfig.ts`.

### File: `src/lib/userAccessConfig.ts`
**Line 122** — update menus array:

```
// Before
menus: ["Dashboard", "Inbox", "Team Hub", "Pipeline", "Time Clock"],

// After
menus: ["Dashboard", "Inbox", "Team Hub", "Business Tasks", "Pipeline", "Time Clock"],
```

### What does NOT change
- No database changes
- No other user configs affected
- No logic changes

