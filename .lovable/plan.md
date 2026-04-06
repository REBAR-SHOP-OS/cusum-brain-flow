

# Add Explicit Absent Staff List to Vizzy Context

## Problem
When asked "how many people are in the company?" or "who hasn't shown up?", Vizzy must cross-reference the TEAM PRESENCE section against the full staff list to compute absent names. This mental math is unreliable — Vizzy sometimes gets it wrong.

## Solution
Add a third presence category ("Not Clocked In Today") that explicitly lists staff members with no time clock entry, so Vizzy reads exact names instead of computing them.

## Changes

### File: `supabase/functions/_shared/vizzyFullContext.ts` (~line 382)

After the "Clocked Out Today" block, add:

```typescript
// Compute absent staff (no clock entry at all today)
const clockedProfileIds = new Set(clockEntries.map((t: any) => t.profile_id));
const absentProfiles = (profiles || []).filter((p: any) => !clockedProfileIds.has(p.id));
if (absentProfiles.length > 0) {
  presenceLines.push("  Not Clocked In Today:");
  absentProfiles.forEach((p: any) =>
    presenceLines.push(`    • ${p.full_name || "Unknown"}`)
  );
}
```

Also update the FACTS block (~line 838) to include `absent` count:
```
absent=${absentProfiles.length}
```

And update the STAFF PRESENCE summary line:
```
STAFF PRESENCE: X currently clocked in, Y clocked out today, Z absent, N total registered staff
```

### Redeploy
- `admin-chat`, `vizzy-daily-brief`, `vizzy-pre-digest` (they share this context file)

## Result
- Vizzy sees explicit absent names — no inference needed
- "How many people are here?" → reads Currently Clocked In count + names directly
- "Who hasn't shown up?" → reads Not Clocked In Today list directly

