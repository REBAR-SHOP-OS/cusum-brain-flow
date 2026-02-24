

## Fix Remaining Security Findings

### 1. Fix: Contacts "Admins can read all contacts" Policy (database change)

The SELECT policy "Admins can read all contacts" targets the `public` role instead of `authenticated`. This will be dropped and recreated targeting `authenticated` only.

```text
DROP POLICY "Admins can read all contacts" ON public.contacts;
CREATE POLICY "Admins can read all contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));
```

After fixing, mark `contacts_table_public_exposure` as resolved/ignored -- RLS enforces company-scoped, role-based access with no public exposure.

### 2. Acknowledge: Employee Salaries (no database change needed)

RLS is correctly implemented: admin-only, company-scoped for all CRUD operations. The finding suggests MFA and field-level encryption which are infrastructure-level concerns beyond what can be implemented here. Mark as ignored with documentation.

### 3. Acknowledge: Gmail Tokens (no database change needed)

RLS denies ALL client access (SELECT/INSERT/UPDATE/DELETE all return `false` for authenticated users). Only service_role can access. The finding suggests encryption at rest which requires Vault (unavailable in this environment). Mark as ignored with documentation.

### Technical Summary

| Finding | Action |
|---------|--------|
| contacts_table_public_exposure | Fix policy role public->authenticated, then ignore |
| employee_salaries_inadequate_protection | Ignore (RLS already admin+company scoped) |
| user_gmail_tokens_token_exposure | Ignore (RLS denies all client access) |

Only one migration is needed (contacts policy fix). No UI, logic, or other changes.

