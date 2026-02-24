

## Fix Remaining Security Findings

### Finding 1: wwm_standards Anonymous Access Policy (warn)

**Problem:** The "Admins can manage wwm standards" policy is granted to the `public` role instead of `authenticated`. This technically allows anonymous users to hit the policy (though the USING clause checks `user_roles` which requires auth.uid(), so exploitation risk is low).

**Fix:** Drop and recreate the policy targeting `authenticated` only.

```sql
DROP POLICY IF EXISTS "Admins can manage wwm standards" ON public.wwm_standards;
CREATE POLICY "Admins can manage wwm standards"
  ON public.wwm_standards
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  ));
```

---

### Finding 2: SQL Injection via Empire Agent (error)

**Problem:** `execute_readonly_query(text)` and `execute_write_fix(text)` are SECURITY DEFINER functions that accept raw SQL strings. Even though they're restricted to `service_role`, the AI agent could be manipulated via prompt injection to query sensitive tables (e.g., `user_gmail_tokens`, `user_ringcentral_tokens`).

**Fix:** Add a sensitive-table blocklist inside both functions to prevent access to OAuth token tables and auth schema, regardless of what SQL the AI generates.

**For `execute_readonly_query`:**
- Block queries referencing sensitive tables: `user_gmail_tokens`, `user_ringcentral_tokens`, `user_meta_tokens`, `auth.`
- Block DDL commands: `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`
- Enforce SELECT-only

**For `execute_write_fix`:**
- Same sensitive-table blocklist
- Block DDL commands
- Keep existing single-statement and 4000-char guards

```text
Validation pseudocode (added to both functions):

IF sql_query matches (user_gmail_tokens|user_ringcentral_tokens|user_meta_tokens|auth\.) THEN
  RAISE EXCEPTION 'Access to sensitive tables denied';
END IF;

IF sql_query matches (DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE) THEN
  RAISE EXCEPTION 'DDL commands not allowed';
END IF;
```

---

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | Fix wwm_standards policy + harden both SQL execution functions |

### No Other Changes

Per the surgical execution law, no UI, logic, or other database objects will be modified.

