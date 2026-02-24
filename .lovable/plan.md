
## Fix Feedback RLS Error and Restrict to @rebar.shop Users

### Problem 1: RLS Violation on Task Insert
The error "new row violates row-level security policy" occurs because `companyId` from `useCompanyId()` may still be loading (null) when the user clicks Send. The code falls back to a hardcoded UUID (`a0000000-...`), which doesn't match the user's actual company in the RLS policy `company_id = get_user_company_id(auth.uid())`.

### Problem 2: Domain Restriction
Only users with `@rebar.shop` email domain should be able to submit feedback.

### Solution
**File: `src/components/feedback/AnnotationOverlay.tsx`**

1. Add domain check at the start of `handleSend`: fetch the current user's email, verify it ends with `@rebar.shop`, and show a toast error + return early if not.

2. Fix RLS violation: before inserting, ensure `companyId` is available. If it's still null, fetch it directly from the user's profile instead of using a hardcoded fallback. If still unavailable, show an error and abort.

### Technical Details

Changes in `handleSend` function (~line 167):

- After getting the user (line 199), check `user.email?.endsWith('@rebar.shop')`. If not, toast error and return.
- Replace the fallback `companyId ?? "a0000000-..."` with a guaranteed value: if `companyId` from the hook is null, query `profiles` to get it (we already query profiles at line 206, so we can grab `company_id` in the same query).
- Add `company_id` to the `.select("id, full_name")` call, making it `.select("id, full_name, company_id")`.
- Use `prof.company_id` as fallback when hook's `companyId` is null.
- If still no company ID is found, throw an error instead of using a hardcoded UUID.

### Scope
- Only `src/components/feedback/AnnotationOverlay.tsx` is modified
- No database, UI, or other file changes
