# Expand Approval Rights to Neel + Sattar

Currently only `neel@rebar.shop` can approve social posts (HARD rule enforced in frontend, DB trigger, and regression tests). User wants `sattar@rebar.shop` to also be an approver.

## Changes

### 1. Frontend gates
- `src/components/social/ApprovalsPanel.tsx` — change `canApprove` to accept both emails:
  ```ts
  const APPROVERS = ["neel@rebar.shop", "sattar@rebar.shop"];
  const canApprove = APPROVERS.includes(currentUserEmail ?? "");
  ```
  Update button label/tooltip ("Neel only" → "Approvers only").
- `src/components/social/PostReviewPanel.tsx` — same allowlist in the Neel Approval Gate region.

### 2. Database trigger
- New migration replacing `enforce_neel_only_approval` to allow `neel_approved=true` to be set by either `neel@rebar.shop` or `sattar@rebar.shop` (looked up via `auth.users.email` from `auth.uid()`). Keeps service-role/admin bypass forbidden.

### 3. Regression tests
- `tests/regression/social/neel-only-approval.test.ts` → rename concept to `approver-allowlist.test.ts` (or update in place): assert allowlist contains both `neel@` and `sattar@`, and does NOT include `radin@`, `zahra@`, or other emails. Update DB-trigger grep to match the new trigger name/body.

### 4. Memory update
- Update `mem://index.md` Core rule "Neel Approval Gate (HARD)" → "Approver Gate (HARD): only `neel@rebar.shop` and `sattar@rebar.shop` may set `neel_approved=true`." Update referenced memory file accordingly.

## Out of scope
- Column name `neel_approved` stays (renaming would cascade through many files); semantics simply broaden to "approver-approved".
- No change to who can reject (any reviewer can still reject).

Confirm to proceed.
