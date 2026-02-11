

## Add Team Directory to Vizzy's Context

### Problem
Vizzy doesn't know who's who on the team. When the CEO mentions "Vicky" or "Saurabh," Vizzy can't connect the name to their email, role, or department because there's no team directory in her context.

### Changes

**File: `src/lib/vizzyContext.ts`**

Add a hardcoded **TEAM DIRECTORY** section near the top of the system prompt so Vizzy always knows every team member by name, email, and role:

```
🏢 TEAM DIRECTORY
  • Sattar Esmaeili (sattar@rebar.shop) — CEO
  • Neel Mahajan (neel@rebar.shop) — CEO / Co-founder
  • Vicky Anderson (vicky@rebar.shop) — Accountant
  • Saurabh Seghal (saurabh@rebar.shop) — Sales
  • Ben Rajabifar (ben@rebar.shop) — Estimator
  • Kourosh Zand (kourosh@rebar.shop) — Shop Supervisor
  • Radin Lachini (radin@rebar.shop) — AI Manager
```

This will be placed right after the "TEAM" section (line ~98) so Vizzy can cross-reference names with time clock data and agent activity. When the CEO asks "what did Vicky do today?", Vizzy will know Vicky = vicky@rebar.shop = Accountant, and can look up her clock-in times and agent sessions accordingly.

### Technical Notes
- Single file change, ~10 lines added to the prompt string
- No schema or hook changes needed
