
## Plan: Fix Office Back Button at the Root Cause

### What is actually broken
The issue is no longer `navigate(-1)`.

That part was already changed to `/home`, but the Back button is still being intercepted by `AIExtractView` every time the active section is `"ai-extract"`.

Right now:
- `OfficePortal` always calls the child back handler when section = `ai-extract`
- `AIExtractView` always registers a handler
- that handler always does:
  - `setActiveSessionId(null)`
  - `setShowHistory(true)`

So on the screen shown in your screenshot:
- there is no active session
- history is already open
- clicking Back just re-runs the same state update
- result: nothing appears to happen

### Root cause
The child back handler is unconditional, but it should only handle Back when there is actually an internal step to go back from.

### Correct fix
Make Back behavior state-aware:

1. `AIExtractView` should register a handler that returns whether it actually handled the back action.
2. `OfficePortal` should only stay inside AI Extract if that handler returns `true`.
3. If the handler returns `false`, `OfficePortal` must navigate to `/home`.

### Desired behavior after fix
```text
If user is inside an opened extract session
→ Back closes that session and returns to AI Extract history/list

If user is already on AI Extract start/history screen
→ Back goes to /home

If user is on any other Office section
→ Back goes to /home
```

### Files to update

| File | Change |
|------|--------|
| `src/pages/OfficePortal.tsx` | Change back handler contract from `() => void` to `() => boolean` (or equivalent). If AI Extract does not handle Back, navigate to `/home`. |
| `src/components/office/AIExtractView.tsx` | Register a conditional back handler: only consume Back when `activeSessionId` exists or another real internal substate needs closing. Otherwise return `false`. |
| `src/components/office/OfficeSidebar.tsx` | No logic change required unless type signature needs to be updated for the new handler shape. |

### Implementation shape
- In `AIExtractView`, replace the current unconditional callback registration with a state-aware callback.
- Example logic:
  - if `activeSessionId` exists:
    - `setActiveSessionId(null)`
    - `setShowHistory(true)`
    - return `true`
  - else:
    - return `false`

- In `OfficePortal`:
  - call the registered AI Extract back handler
  - if it returns `false` or is missing, run `nav("/home")`

### Important detail
Because the new handler will depend on current UI state, the registration must stay in sync with state changes. I will update the callback/effect dependencies so it does not keep an outdated behavior.

### What will not change
- sidebar UI and styling
- AI Extract history/list layout
- role access
- database/backend logic

### Validation after implementation
I will verify these exact cases:
1. Back from AI Extract with an opened session → returns to history/list
2. Back from AI Extract initial/history screen → goes to `/home`
3. Back from another Office section → goes to `/home`
4. Mobile sidebar Back behaves the same as desktop
