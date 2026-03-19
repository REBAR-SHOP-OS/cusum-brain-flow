

## Fix Vizzy Person Lookup Failures (4 Areas)

### Problem Summary

Vizzy says "Vicky Anderson doesn't appear in today's data" even though she clocked in. Three root causes:

1. **Timezone bug**: `vizzyFullContext.ts` uses UTC for "today" (`new Date().toISOString().split("T")[0]`), but the business runs on ET. After 7-8pm ET, queries miss the entire day's data because UTC has rolled to the next day.
2. **Name mismatch**: Speech-to-text produces "Neil" but the DB has "Neel Mahajan". "Radin" may be a misheard name. Vizzy has no name alias table to fuzzy-match.
3. **Unhelpful fallback**: When no data is found, Vizzy just says "not in snapshot" without explaining what was checked or offering alternatives.

### Plan

**1. Fix timezone in `vizzyFullContext.ts`** (lines 16, and all `today + "T00:00:00"` references)

Replace UTC-based `today` with ET-based date:
```typescript
const etDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const today = etDate; // "2026-03-19" in ET
```

This ensures all time-clock, email, agent session, and activity queries match the business day.

**2. Add employee name directory with aliases to `VIZZY_INSTRUCTIONS`** in `useVizzyVoiceEngine.ts`

Add a section that maps known employees to speech-to-text variants:
```
═══ EMPLOYEE NAME DIRECTORY ═══
These are the real employee names. Voice input may mishear them — use fuzzy matching:
- Neel Mahajan (may be heard as: Neil, Neal, Nil) — Sales Manager
- Vicky Anderson (may be heard as: Vicki, Vikki) — Accountant
- Sattar Esmaeili (may be heard as: Satar, Sataar) — CEO
- Saurabh Sehgal (may be heard as: Sourab, Sorab) — Sales
- Ben Rajabifar / Behnam (may be heard as: Bin, Benn) — Estimator
- Radin (may be heard as: Radin, Raiden, Riding) — check for this name
When you hear a name that SOUNDS LIKE any of these, treat it as that person.
```

**3. Improve fallback behavior in `VIZZY_INSTRUCTIONS`**

Update the NAME SEARCH PROTOCOL fallback (line 81) from the current generic message to:
```
If the name appears NOWHERE in the data, say: "[Name] has no recorded activity today — I checked time clock, work orders, emails, agent sessions, and activity logs. They may have the day off, or their activity hasn't synced yet. Want me to check anything else about them?"
```

**4. Add cross-check reporting requirement**

Add to NAME SEARCH PROTOCOL:
```
5. When delivering a person report, ALWAYS state which data sources you checked:
   "I checked: time clock, work orders, emails, agent sessions, and activity logs."
   This builds trust and shows thoroughness.
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyFullContext.ts` | Fix UTC → ET timezone for "today" |
| `src/hooks/useVizzyVoiceEngine.ts` | Add name directory with aliases, improve fallback text, add cross-check reporting |

