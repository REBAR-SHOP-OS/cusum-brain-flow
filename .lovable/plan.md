
# Fix Notification 404s + Create Task on Leave Approval

## Problem 1: Notification Centre links to 404

When clicking notifications that link to `/hr`, `/estimation`, `/bills`, and several other paths, users get a 404 because these routes don't exist in `App.tsx`. The most frequent offender is `/hr` (18 notifications).

**Root cause**: The `notify_leave_request` database trigger inserts `link_to: '/hr'`, but no `/hr` route exists. The HR features live inside `/timeclock`.

## Problem 2: Leave approval should create a task

When someone approves or denies a leave request through the hierarchy system, no task is created in the task box. The `reviewRequest` function in `useLeaveManagement.ts` only updates the leave request row -- it doesn't log a human task for follow-up.

---

## Fix 1: Add route redirects for broken notification links

In `src/App.tsx`, add redirect routes so notifications stop 404-ing:

| Broken path | Redirect to |
|---|---|
| `/hr` and `/hr/*` | `/timeclock` |
| `/estimation` | `/pipeline` |
| `/bills` and `/bills/*` | `/accounting` |
| `/invoices/*` | `/accounting` |
| `/intelligence` | `/brain` |
| `/inventory` | `/shop-floor` |
| `/emails/*` | `/inbox` |

Also update the `normalizeRoute` function in `InboxPanel.tsx` to map these same paths client-side before navigation.

---

## Fix 2: Create a human task when a leave request is approved/denied

In `src/hooks/useLeaveManagement.ts`, after a successful `reviewRequest` call, insert a row into the `human_tasks` table so it shows up in the task box.

The task will contain:
- **Title**: "Leave [approved/denied]: [Employee Name] - [Leave Type]"
- **Description**: Dates, total days, and the reviewer's note (if any)
- **Category**: "hr_leave"
- **Severity**: "info"
- **Source agent**: "hr"
- **Assigned to**: The reviewer's profile ID (so it appears in their task list)

---

## Files to change

| File | Change |
|---|---|
| `src/App.tsx` | Add 7 redirect routes before the catch-all `*` route |
| `src/components/panels/InboxPanel.tsx` | Extend `normalizeRoute` to map broken paths |
| `src/hooks/useLeaveManagement.ts` | After successful review, insert a `human_tasks` row |

## Technical notes

- Redirect routes use React Router's `Navigate` component with `replace`, which is already imported in `App.tsx`
- The `human_tasks` insert uses the existing table schema (company_id, title, description, category, severity, status, source_agent, assigned_to)
- No database schema changes needed
- No edge function changes needed
- Self-approval guard remains intact -- tasks are only created after successful status update
