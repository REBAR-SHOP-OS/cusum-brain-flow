## Restrict TimeClock "Memory" button access

Only `zahra@rebar.shop` and `sattar@rebar.shop` should see/access the Memory button (Face Memory Panel) on `/timeclock`. All other users — including Radin and other admins — must not see it.

### Change

In `src/pages/TimeClock.tsx`:

1. Add a derived flag near the top of the component:
   ```ts
   const canAccessFaceMemory = ["zahra@rebar.shop", "sattar@rebar.shop"]
     .includes((user?.email || "").toLowerCase());
   ```

2. Wrap both Memory `<Button>` instances (lines ~348 and ~459) with `{canAccessFaceMemory && ( ... )}`.

3. Also gate the panel mount at line 742 with the same flag so it can never be opened by other users.

No backend / RLS changes — this is a UI access gate per the user's request.
