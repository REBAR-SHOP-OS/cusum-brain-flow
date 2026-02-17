

# Employee Hierarchy + Leave Approval Routing + Org Chart

## Overview

Add `manager_id` to the `profiles` table, enforce leave approval routing based on the reporting hierarchy, and create a visual Org Chart page. All changes are surgical -- no existing modules are altered beyond what's strictly needed.

---

## PART 1: Database -- Hierarchy Structure

### Migration: Add `manager_id` column + seed data

Add a nullable `manager_id` column (self-referencing FK) to `profiles`, then populate based on the given hierarchy:

```
Sattar (CEO) -- no manager
  |-- Vicky -- reports to Sattar
  |-- Neel -- reports to Sattar
  |   |-- Behnam -- reports to Neel
  |   |-- Saurabh -- reports to Neel
  |   |-- Kourosh -- reports to Neel
  |   |-- Tariq Amiri -- reports to Neel
  |-- Radin -- reports to Sattar
```

**Migration SQL:**
- `ALTER TABLE profiles ADD COLUMN manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL`
- UPDATE statements to set the hierarchy per the org chart above
- A validation trigger `validate_no_circular_manager()` to prevent circular reporting (checks 10 levels deep max)

**RLS/permissions**: Only admins can UPDATE `manager_id` (enforced via a trigger similar to `protect_profile_company_id`).

---

## PART 2: Leave Approval Routing

### 2a. Database changes

Add two columns to `leave_requests`:
- `assigned_approver_id UUID REFERENCES profiles(id)` -- the computed approver
- `approval_routing TEXT` -- log describing the routing chain used (e.g., "direct_manager:Neel", "fallback_ceo:Sattar")

Add a trigger `assign_leave_approver()` on INSERT to `leave_requests` that:
1. Looks up the requester's `manager_id`
2. If manager exists AND manager != requester --> assign manager
3. If no manager --> fallback to CEO profile (Sattar, department='admin', email='sattar@rebar.shop')
4. If computed approver == requester --> fallback to first admin that is NOT the requester
5. Logs the routing chain in `approval_routing`

Add a trigger `block_self_approval()` on UPDATE to `leave_requests` that:
- When status changes to 'approved' or 'denied', verifies `reviewed_by != profile_id`
- RAISES EXCEPTION if self-approval is attempted (hard backend block)

### 2b. Hook changes (`useLeaveManagement.ts`)

- Add `assigned_approver_id` and `approval_routing` to the `LeaveRequest` interface
- No changes to `submitRequest` -- the trigger handles approver assignment
- In `reviewRequest`: add a client-side guard that checks `myProfile.id !== request.profile_id` before calling update (defense-in-depth; backend trigger is the real enforcement)
- Return `assigned_approver_id` data to the UI

### 2c. UI changes (`TeamCalendarTab.tsx`)

- Show "Assigned Approver: [Name]" on each pending leave request card
- Show/hide Approve/Deny buttons: only visible if current user's profile_id matches `assigned_approver_id` OR current user is admin
- Show `approval_routing` as a small muted text on reviewed requests

### 2d. UI changes (`MyLeaveTab.tsx`)

- Show "Approver: [Name]" on each of the user's own leave request cards

---

## PART 3: Org Chart Page

### New file: `src/pages/OrgChart.tsx`

A standalone page with:
- Tree diagram built with HTML/CSS (no new dependencies), using recursive rendering
- Each node shows: Avatar, Name, Title, Department badge
- Click node to navigate to that employee's profile in Member Area
- Expand/Collapse toggle per subtree
- Search bar at top (filters by name or email, highlights matching nodes)
- "Reports To" and "Direct Reports" info visible on each node

### New route in `App.tsx`

- Add `<Route path="/org-chart" element={<P><OrgChart /></P>} />` in the System section

### Link from Member Area

- Add a "View in Org Chart" link/button in the `MyProfileTab` component that navigates to `/org-chart`

---

## Files Modified

| File | Change |
|---|---|
| **Database migration** | Add `manager_id` to profiles, seed hierarchy, add anti-circular trigger, add `protect_manager_id` trigger |
| **Database migration** | Add `assigned_approver_id` + `approval_routing` to `leave_requests`, add `assign_leave_approver` trigger, add `block_self_approval` trigger |
| `src/hooks/useLeaveManagement.ts` | Add new fields to interface, add client-side self-approval guard |
| `src/hooks/useProfiles.ts` | Add `manager_id` to Profile interface |
| `src/components/timeclock/TeamCalendarTab.tsx` | Show approver name, conditionally show Approve/Deny buttons |
| `src/components/timeclock/MyLeaveTab.tsx` | Show assigned approver on user's own requests |
| `src/pages/OrgChart.tsx` | **New file** -- visual org chart page |
| `src/App.tsx` | Add `/org-chart` route |
| `src/components/office/MemberAreaView.tsx` | Add "View in Org Chart" link |

## Guards and Safety

- **Anti-circular manager**: DB trigger prevents cycles up to 10 levels
- **Admin-only manager changes**: DB trigger blocks non-admin updates to `manager_id`
- **Self-approval hard block**: DB trigger on `leave_requests` UPDATE raises exception
- **Client-side defense**: Hook checks `myProfile.id !== request.profile_id`
- **UI gating**: Approve/Deny buttons hidden unless user is assigned approver or admin
- **No domino effects**: Existing leave submission flow unchanged; trigger auto-populates new fields
- **Existing data**: Current leave requests will have `assigned_approver_id = NULL` (treated as "legacy -- any admin can review")

## Test Scenarios

- Behnam submits leave --> `assigned_approver_id` = Neel (direct manager)
- Neel submits leave --> `assigned_approver_id` = Sattar (direct manager)
- Sattar submits leave --> `assigned_approver_id` = another admin (fallback, not self)
- Self-approval attempt via API --> blocked by `block_self_approval` trigger with exception

