

## Phase 1 -- Stop the Bleeding (Same Day)

### 1. Enable RLS on `accounting_mirror_customers`

**Current state:** `relrowsecurity = false`, zero policies. Any authenticated user can read/write all customer financial data across companies.

**Fix:**
- Enable RLS on the table
- Add SELECT policy: `company_id = public.get_user_company_id(auth.uid())`
- Add INSERT/UPDATE policy with same company scope
- Add DELETE policy restricted to admin role

**Migration SQL:**
```sql
ALTER TABLE public.accounting_mirror_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped select" ON public.accounting_mirror_customers
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company-scoped insert" ON public.accounting_mirror_customers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company-scoped update" ON public.accounting_mirror_customers
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin delete only" ON public.accounting_mirror_customers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

---

### 2. Fix TableRowActions React ref bug

**Current state:** Lines 56 and 97 use plain `<button>` inside `<PopoverTrigger asChild>`. Radix requires `forwardRef` on `asChild` children.

**Fix:** Replace the two plain `<button>` elements with `React.forwardRef`-compatible components. The simplest approach is to use the existing shadcn `<Button>` component with `variant="ghost"` and `size="icon"` styling, which already supports ref forwarding. This eliminates the Radix ref warnings.

**File:** `src/components/accounting/TableRowActions.tsx`
- Line 56-61: Replace `<button>` with `<Button variant="ghost" size="icon" ...>`
- Line 97-102: Same replacement for the Reschedule trigger

---

### 3. Deduplicate chat/QB refresh bug reports

**Current state:** Three identical open entries in `vizzy_fix_requests`:
- `dfb736a2` (Feb 18 15:38) -- oldest, keep as canonical
- `7d5e1995` (Feb 18 15:52) -- duplicate
- `98f891de` (Feb 18 16:39) -- duplicate

**Fix:** Close the two newer duplicates by updating their status to `resolved` with a note linking to the canonical entry. No code change needed -- data operation only.

---

## Phase 2 -- Structural Security Hardening (This Week)

### 4. Audit and fix Security Definer Views

**Current state:** The linter flags a SECURITY DEFINER view. Four public views exist:
- `profiles_safe` -- masks PII but has NO row filter (exposes all profiles)
- `contacts_safe` -- uses `has_role()` for column masking
- `user_meta_tokens_safe` -- filters by `auth.uid()`
- `events` -- plain alias for `activity_events`

The security definer view likely bypasses RLS on its source table, meaning any user querying it gets data as the view owner (superuser).

**Fix:** Recreate the flagged view(s) with `SECURITY INVOKER` (Postgres 15+) or drop and replace with a function-based approach. The `profiles_safe` view is the most concerning since it has no row-level filter at all -- add a `WHERE company_id = get_user_company_id(auth.uid())` clause.

---

### 5. Lock OAuth token tables to service-role only

**Current state:** Token tables use `USING (false)` SELECT policies ("No direct token reads") which technically works but is fragile -- if another policy is added, it could override. Gmail tokens still allow user INSERT/UPDATE.

**Fix:**
- Revoke all direct client access policies on `user_gmail_tokens`, `user_ringcentral_tokens`, `user_meta_tokens`
- Replace with explicit deny-all for the `authenticated` role on SELECT/INSERT/UPDATE/DELETE
- Edge functions use `service_role` key which bypasses RLS entirely, so they remain unaffected
- Create a `get_my_gmail_status()` SECURITY DEFINER function (like existing `get_my_rc_status()`) so clients can check connection status without reading raw tokens

---

### 6. Fix company_id context propagation in ai-agent tool execution

**Current state:** The `ai-agent` edge function retrieves `companyId` early (line ~4725) with a fallback to `a0000000-...`. However, some tool execution branches may not propagate this correctly, and hardcoded company IDs appear in multiple places (lines 4743, 4903, 5046, 5224).

**Fix:**
- Add a guard at tool execution entry: if `companyId` is null/undefined, fail the tool call with a clear error instead of silently proceeding
- Replace all hardcoded `a0000000-...` references with the resolved `companyId` variable
- Ensure `companyId` is passed into every tool handler that queries company-scoped tables

**File:** `supabase/functions/ai-agent/index.ts`

---

## Phase 3 -- Permission Hygiene (Next Sprint)

### 7. Role-based tightening (payroll, salaries, POs, quotes)

Review and restrict RLS on sensitive financial tables (`employee_salaries`, `purchase_orders`, `quote_requests`) to appropriate roles only (admin, accounting). Currently these may be visible to all authenticated users within the company.

### 8. Investigate system-backup multi-trigger issue

The `system-backup` edge function appears to spawn redundant concurrent instances. Investigate whether the cron trigger or webhook is firing multiple times and add idempotency guards (e.g., check last backup timestamp before proceeding).

---

## Summary of Changes

| Item | Type | Risk | Effort |
|------|------|------|--------|
| RLS on accounting_mirror_customers | Migration | Critical fix | 10 min |
| TableRowActions ref bug | Code edit | Low risk | 5 min |
| Deduplicate vizzy_fix_requests | Data operation | Zero risk | 2 min |
| Security Definer View fix | Migration | Medium risk | 15 min |
| OAuth token lockdown | Migration | Medium risk | 15 min |
| company_id propagation fix | Edge function edit | Medium risk | 20 min |
| Role-based tightening | Migration | Low risk | 30 min |
| system-backup investigation | Investigation | N/A | TBD |

