## Goal
Restrict post approval to **only** `neel@rebar.shop`. Currently `sattar@rebar.shop` and `radin@rebar.shop` can also approve (via the "Approve Post" button in `PostReviewPanel`) and any `social_approvals` row can be flipped to `approved` by the marketing team via `ApprovalsPanel`. Both paths must be locked to Neel.

## Changes

### 1. Frontend — `src/components/social/PostReviewPanel.tsx` (line 1412)
Tighten the gate from a 3-email allowlist to a single email:
- `currentUserEmail === "neel@rebar.shop"` only.
- Sattar / Radin fall through to the disabled **"Awaiting Approval"** button.

### 2. Frontend — `src/components/social/ApprovalsPanel.tsx`
Hide / disable the **Approve** button (line 139-145) unless `currentUserEmail === "neel@rebar.shop"`. Read the email from the existing auth hook used elsewhere. Reject remains available for all reviewers (only approval is locked).

### 3. Server-side hard gate — new migration
Add a DB trigger on `public.social_posts` that **rejects any update** flipping `neel_approved` from `false`→`true` unless the acting user's email is `neel@rebar.shop`. This is the real enforcement — frontend changes alone can be bypassed via direct API calls.

```sql
CREATE OR REPLACE FUNCTION public.enforce_neel_only_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acting_email text;
BEGIN
  IF NEW.neel_approved IS DISTINCT FROM OLD.neel_approved AND NEW.neel_approved = true THEN
    SELECT lower(email) INTO acting_email FROM auth.users WHERE id = auth.uid();
    IF acting_email <> 'neel@rebar.shop' THEN
      RAISE EXCEPTION 'Only neel@rebar.shop can approve social posts';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_enforce_neel_only_approval
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_neel_only_approval();
```

Service-role / cron paths are unaffected because `auth.uid()` is null there — the trigger will block those too, so cron publish (which reads `neel_approved`, doesn't flip it) is fine. Auto-generate inserts with `neel_approved=false` so INSERTs are not gated.

### 4. Regression test — `tests/regression/social/neel-only-approval.test.ts`
Static check: assert `PostReviewPanel.tsx` only references `neel@rebar.shop` in the approve gate (no `sattar`, no `radin` in that conditional), and `ApprovalsPanel` guards `handleApprove` by email.

### 5. Memory update
Update the existing **Neel Approval Gate (HARD)** core rule in `mem://index.md` to add: "Only `neel@rebar.shop` may set `neel_approved=true`. No other admin/marketing user, ever. Enforced by DB trigger + frontend gate."

## Out of scope
- Reject flow stays open to the marketing team.
- Auto-generate / Vizzy paths unchanged (they never set `neel_approved=true`).
- No changes to publish gate logic itself (it already requires `neel_approved=true`).
