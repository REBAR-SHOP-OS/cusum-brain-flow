

# Fix 4 Security Findings

## Overview

Four security scanner findings need resolution. Two require actual database changes, and two are already properly secured (will be marked as resolved).

---

## Finding 1: "Employee Personal Information Could Be Stolen" (profiles)

**Current state:** The `profiles_safe` view (with `security_invoker=on`) exposes `phone` and `email` columns to all authenticated company members via the base table's "Company members can read company profiles" policy.

**Fix:** Remove `phone` from the `profiles_safe` view. Email is needed for team features (SettingsPeople, mentions, etc.) but phone numbers are only used in admin contexts (AdminPanel) which queries the base `profiles` table directly with admin-only RLS.

**Migration:**
```sql
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker=on) AS
  SELECT id, user_id, full_name, title, department, duties,
         email, avatar_url, is_active, preferred_language,
         employee_type, created_at, updated_at
  FROM public.profiles;
-- phone column removed
```

---

## Finding 2: "Email Account Credentials Could Be Compromised" (user_gmail_tokens)

**Current state:** RLS is enabled. There are INSERT and UPDATE policies but no SELECT policy. While RLS default-denies reads, an explicit deny-all SELECT policy is best practice (defense in depth). No frontend code queries this table -- only edge functions via service role.

**Fix:** Add an explicit deny-all SELECT policy.

**Migration:**
```sql
CREATE POLICY "No direct token reads"
  ON public.user_gmail_tokens
  FOR SELECT
  TO authenticated, anon
  USING (false);
```

---

## Finding 3: "Employee Salary Information Could Be Leaked" (employee_salaries)

**Current state:** Already properly secured -- SELECT restricted to `has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid())`. Only admin users within the same company can access salary data. Financial access audit trigger is also in place.

**Action:** Mark finding as resolved (no code change needed).

---

## Finding 4: "Financial Records Could Be Accessed by Unauthorized Users" (accounting_mirror)

**Current state:** Already properly secured -- SELECT restricted to `has_any_role(auth.uid(), ['admin', 'accounting']) AND company_id = get_user_company_id(auth.uid())`. Only admin/accounting roles within the same company can access. Financial access audit trigger is in place.

**Action:** Mark finding as resolved (no code change needed).

---

## Summary of Changes

| Item | Action |
|------|--------|
| `profiles_safe` view | Recreate without `phone` column |
| `user_gmail_tokens` table | Add explicit deny-all SELECT policy |
| `employee_salaries` finding | Mark as resolved (already secure) |
| `accounting_mirror` finding | Mark as resolved (already secure) |

No frontend code changes needed -- `phone` is not used from `profiles_safe` in any component (only from the base `profiles` table in admin-only pages).

