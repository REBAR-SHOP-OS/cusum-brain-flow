

## Investigation: Ben's Inbox Appears Empty

### Findings

After thorough investigation, there is **no `inbox_items` table** in this project. The bug report's root cause analysis is incorrect.

**What actually exists:**
- `notifications` table — powers the InboxPanel (sidebar notification bell). Ben has **78 unread** notifications with correct RLS policies (`user_id = auth.uid()` and `assigned_to` via profiles join)
- `communications` table — powers the email InboxView. Ben has **183 records** (131 Gmail, 52 RingCentral) with correct RLS policies
- `get_user_company_id()` returns the correct company for Ben

**RLS policies verified and working:**
- `notifications` SELECT: two policies, both correctly matching Ben's user_id and profile
- `communications` SELECT: correctly scoped by `company_id` AND `user_id`

### Possible Real Causes

1. **Email InboxView is unreachable** — The `/inbox-manager` route redirects to `/home`, so users can't access the email inbox. If Ben is looking for his email inbox, there's no route to get there.
2. **Session/auth issue** — If Ben's token is expired or he's not fully authenticated, the client-side `supabase.auth.getUser()` returns null, causing `useCommunications` to short-circuit and show nothing.
3. **InboxPanel filtering** — The notification panel only shows the last 50 items and filters out "dismissed" ones. If Ben previously dismissed notifications, they won't reappear.

### Recommended Action

Since the backend data and RLS are correct, this is likely a **frontend routing or session issue**, not a database access problem. No SQL migration is needed.

If you can clarify which specific page/panel appears empty for Ben (the bell notification panel, or an email inbox view), I can provide a targeted fix.

