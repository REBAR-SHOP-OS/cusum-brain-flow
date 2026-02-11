

## Vizzy Fix Request Queue — Log Issues for Lovable

### What This Does
When you're on the shop floor talking to Vizzy, you can tell her about a bug or issue (e.g., "the delivery screen is showing wrong dates"). Vizzy will log it to a database table with details and optionally a photo. Later, when you open this Lovable chat, you can reference those logged issues and I'll fix them.

### How It Works

1. **New database table** `vizzy_fix_requests` stores each logged issue with:
   - Description of the problem
   - Screenshot/photo URL (if one was taken during the session)
   - Page or feature affected
   - Status (open / resolved)
   - Timestamp

2. **New Vizzy client tool** `log_fix_request` — when you tell Vizzy "this screen is broken" or "log a bug about deliveries", she calls this tool. It goes through the same approval dialog so you confirm before it's saved.

3. **New ERP action handler** in the `vizzy-erp-action` edge function to insert the fix request into the database.

4. **Fix Request Queue UI** — a small panel on the CEO dashboard showing open fix requests, so you can quickly copy/paste or reference them in this chat.

### Technical Details

**Database Migration:**
```sql
CREATE TABLE public.vizzy_fix_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  affected_area TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.vizzy_fix_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fix requests"
  ON public.vizzy_fix_requests FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Files to modify:**
- `supabase/functions/vizzy-erp-action/index.ts` — add `log_fix_request` action that inserts into `vizzy_fix_requests`
- `src/components/vizzy/VoiceVizzy.tsx` — register `log_fix_request` client tool
- `src/lib/vizzyContext.ts` — add tool description so Vizzy knows how to use it
- `src/pages/CEOPortal.tsx` — add a small "Fix Requests" section showing open items

**New file:**
- `src/components/ceo/FixRequestQueue.tsx` — displays open fix requests with description, photo, and a "copy to clipboard" button for easy pasting into Lovable chat

### User Flow
1. You're on the shop floor, talking to Vizzy
2. You say: "Vizzy, log a bug — the delivery tracker is showing yesterday's routes"
3. Vizzy shows approval dialog: "Log fix request: delivery tracker showing yesterday's routes"
4. You tap Approve
5. Saved to database
6. Later, you open CEO dashboard, see the fix request, and paste it into Lovable chat
7. I fix it

