# RLS Policy Templates (Canonical)

All new `public.*` tables MUST use one of these three patterns. Permissive predicates
(`USING (true)`, `auth.uid() IS NOT NULL`, `auth.role() = 'authenticated'`) are
forbidden by the **RLS Predicate Standard** core rule and will be re-flagged by the
security scanner on every run.

---

## 1. Company-scoped (ERP entities)

Use for any table that belongs to a tenant: customers, quotes, orders, invoices,
production records, etc. Row carries `company_id NOT NULL`.

```sql
CREATE TABLE public.<table> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  -- domain columns ...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;

ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select" ON public.<table>
  FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "<table>_insert" ON public.<table>
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "<table>_update" ON public.<table>
  FOR UPDATE TO authenticated
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "<table>_delete" ON public.<table>
  FOR DELETE TO authenticated USING (is_company_member(company_id));
```

## 2. Owner-scoped (personal tools)

Use for marketing assets, personal tasks, drafts, user preferences. Row carries
`user_id NOT NULL`.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_owner_all" ON public.<table>
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## 3. Role-gated (admin / marketing / accounting)

Use when access is governed by `user_roles`, not tenancy.

```sql
CREATE POLICY "<table>_admin_all" ON public.<table>
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- or multi-role:
CREATE POLICY "<table>_social_team" ON public.<table>
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','marketing']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','marketing']::app_role[]));
```

---

## Public read surface allowlist

The only places where `USING (true)` is permitted are read-only public surfaces.
Each must be listed here and reflected in `security_memory` so the scanner stops
re-flagging them.

| Table / bucket | Surface | Grant | Notes |
|---|---|---|---|
| `concierge_public_*` | `/embed/concierge` widget | `GRANT SELECT TO anon` only | No INSERT/UPDATE/DELETE to anon |
| storage bucket `public-assets` | Marketing site | `public = true` | Uploads restricted to authenticated |

Adding a new public surface requires:
1. A row in the table above.
2. A matching entry in `security_memory` (via `security--update_memory`).
3. `SELECT`-only grant — never write access to `anon`.

---

## Regression check

`tests/security/no_permissive_policies.sql` scans `pg_policies` and lists any
policy whose `qual` or `with_check` matches a forbidden predicate. Run it
manually before publish, or against the live DB via `supabase--read_query`.
