

## Vizzy Intelligence Audit: Root Cause Analysis & Fix Plan

### Problems Found

**1. Critical Code Bug: `emailProfileMap` used before declaration**
In `vizzyFullContext.ts`, `emailProfileMap` is used at lines 492 and 513 (footprint section) but only declared at line 567. This is a JavaScript temporal dead zone error that crashes the context builder silently.

**2. RingCentral calls can never match employees**
RC calls store phone numbers (e.g., `+14166400773`) in `from_address`/`to_address`, but the matching logic tries to extract email addresses from those fields. Profiles have no phone numbers stored. Result: every call is attributed to a raw phone number, never to an employee name.

**3. RingCentral sync is stale**
Last synced call data is from **February 25** — nearly a month ago. No calls exist in the database after that date. Vizzy correctly says "no calls today" but doesn't flag that the sync is broken.

**4. Call notes query only looks at today**
The "Notes of your call" emails are queried with a `today` filter, but the most recent call notes are from March 4. Vizzy should reference recent call notes, not just today's.

**5. Vizzy says "no activity" without explaining WHY**
When there's genuinely no data, Vizzy should flag potential sync issues instead of just saying "no calls recorded."

---

### Implementation Plan

#### Step 1: Fix `emailProfileMap` declaration order
Move the `emailProfileMap` declaration from line 567 to before line 476 (before the Digital Footprint section that uses it). This fixes the crash.

#### Step 2: Add phone-to-employee mapping for RC calls
Build a phone extension directory in `vizzyFullContext.ts` that maps known RingCentral phone numbers to employee names. Since profiles don't have phone fields, we'll create a hardcoded mapping based on the data (top outbound numbers: `+14166400773` = 208 calls, `+14168603668` = 36, etc.). We'll also extract employee names from the call note email `to_address` field to auto-build mappings.

#### Step 3: Expand call notes to last 7 days
Change the call notes query from `today` filter to `last 7 days` so Vizzy always has recent conversation content to reference.

#### Step 4: Add sync staleness detection
Check the most recent RC call date. If older than 24 hours, add a warning line to the context: "RC sync appears stale — last call data from [date]". This lets Vizzy proactively tell the CEO about the issue.

#### Step 5: Audit and update Vizzy instructions
Update `useVizzyVoiceEngine.ts`:
- Add instruction: "If call data shows 0 calls but sync staleness is flagged, tell the CEO the phone system sync may be down"
- Add instruction: "When no data exists today, reference RECENT call notes from the last 7 days"
- Remove assumption that all data is always fresh
- Add banned phrase: "No calls recorded today" without checking sync status first

### Technical Details

**Files to modify:**
- `supabase/functions/_shared/vizzyFullContext.ts` — fix emailProfileMap order, add phone mapping, expand call notes window, add sync staleness check
- `src/hooks/useVizzyVoiceEngine.ts` — update instructions for sync-awareness and recent call notes handling

