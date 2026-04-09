

# Add User Management to Vizzy Brain Panel

## What This Does
Adds a "+" button at the end of the user avatar bar in Vizzy Brain. Clicking it opens a dialog where a super admin can add a new user email. The new user starts with **zero access** (no agents, no menus, no automations), and the admin can then configure their permissions using the existing AccessEditor.

## Architecture

```text
[+] Button → Add User Dialog (email input)
    ↓
1. Insert into user_access_overrides (agents=[], menus=[], automations=[])
2. Add email to allowedLoginEmails in accessPolicies.ts (client gate)
3. Update server-side restrict_signups() trigger via migration
4. Create profile entry so user appears in avatar bar
```

## Implementation Steps

### Step 1 — Database Migration
- Update `restrict_signups()` trigger to read allowed emails from a **table** instead of a hardcoded array. Create a new table `allowed_login_emails` with a single `email` column.
- Seed it with the current 10 allowed emails.
- This way, adding a user at runtime (via INSERT) automatically updates the server-side gate — no code deploy needed.

### Step 2 — Add User Dialog Component
Create `src/components/vizzy/AddUserDialog.tsx`:
- Simple dialog with email input field
- On submit:
  - Insert email into `allowed_login_emails` table
  - Insert/upsert into `user_access_overrides` with empty arrays for agents, menus, automations
  - Insert a stub profile row (full_name derived from email prefix, company_id = "rebar")
- Only visible to super admins

### Step 3 — Wire "+" Button into VizzyBrainPanel
In `VizzyBrainPanel.tsx` (after the user chips loop, ~line 2111):
- Add a `UserPlus` icon button that opens the AddUserDialog
- Only render for super admin users
- On successful add, invalidate profiles query so new user appears in the avatar bar

### Step 4 — Update Client-Side Whitelist
Modify `accessPolicies.ts` to dynamically read from `allowed_login_emails` table instead of hardcoded array, OR keep the hardcoded list as fallback and also check the DB table. Since the server trigger is the real gate, the client list is just UX — we can keep the static list and add an async check.

### Step 5 — Access Configuration Flow
After adding a user, the admin clicks their avatar chip → sees the existing AccessEditor with all items unchecked (zero access). They can then toggle agents, menus, and automations as needed. **No new UI needed** — the existing AccessEditor already handles this via `user_access_overrides`.

## Files Changed
| File | Change |
|---|---|
| `supabase/migrations/new.sql` | Create `allowed_login_emails` table, update trigger to read from it |
| `src/components/vizzy/AddUserDialog.tsx` | New — email input dialog |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add "+" button after user chips |
| `src/lib/accessPolicies.ts` | Minor — keep as UX fallback |

## Security
- Only super admins can see/use the add button
- New users get zero access by default
- Server-side trigger remains the authoritative gate
- RLS on `allowed_login_emails` restricts writes to admins

