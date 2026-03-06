

# Hide Specific Users from Team Status

## Change
**File: `src/pages/TimeClock.tsx` — Line 175**

Filter out "General Labour" and "Ryle Lachini" from the displayed profiles:

```typescript
const activeProfiles = profiles.filter(
  (p) => !["General Labour", "Ryle Lachini"].includes(p.full_name)
);
```

Single-line change. All other users remain visible.

