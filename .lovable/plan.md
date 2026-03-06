

# Fix: Show All Profiles in Team Status

## Problem
Line 175 in `src/pages/TimeClock.tsx` filters profiles by `is_active !== false`. Since `is_active` now reflects clock-in status (not employment status), the Team Status tab only shows currently clocked-in users instead of all employees.

## Solution
Change the Team Status section to show **all profiles** instead of only active ones. The `is_active` field is used for real-time clock status, not for filtering who appears in the list.

### File: `src/pages/TimeClock.tsx`
- **Line 175**: Change `activeProfiles` filter to show all profiles:
  ```typescript
  const activeProfiles = profiles; // Show all employees regardless of clock status
  ```

This single-line change will restore the full employee list in Team Status while keeping the active/off badges working correctly based on clock entries.

**Note**: Other files (OrgChart, MemberAreaView, SettingsPeople, etc.) also filter by `is_active`. These should remain as-is since they serve different purposes, but if needed we can revisit them.

