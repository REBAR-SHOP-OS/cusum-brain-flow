

# Fix SECURITY DEFINER Views + Post-Fix Verification

## Step 1: Apply Migration

Set `security_invoker = true` on the 6 remaining views (`profiles_safe` already done).

```sql
ALTER VIEW public.v_customers_clean SET (security_invoker = true);
ALTER VIEW public.v_customer_company_map SET (security_invoker = true);
ALTER VIEW public.v_orders_enriched SET (security_invoker = true);
ALTER VIEW public.v_deliveries_enriched SET (security_invoker = true);
ALTER VIEW public.v_leads_enriched SET (security_invoker = true);
ALTER VIEW public.v_communications_enriched SET (security_invoker = true);
```

Note: `profiles_safe` already has `security_invoker = true` — no action needed.

## Step 2: Post-Fix Verification Results (Pre-Determined)

### Grants on all 7 views
All views grant full privileges (`arwdDxtm`) to `anon`, `authenticated`, `service_role`, and `postgres`. This is a default Supabase schema-level grant — it means the **grant layer does NOT restrict access**. Security relies entirely on base-table RLS.

### Base-Table RLS Summary (anon exposure)

| Base Table | Anon SELECT Policy | Effect After Fix |
|---|---|---|
| `customers` | `USING(true)` — wide open | **EXPOSED**: anon can read ALL customers through `v_customers_clean` and `v_customer_company_map` |
| `leads` | `USING(true)` — wide open | **EXPOSED**: anon can read ALL leads through `v_leads_enriched` |
| `profiles` | `USING(false)` — deny | **SAFE**: anon blocked |
| `orders` | No anon policy | **SAFE**: anon blocked by default-deny |
| `deliveries` | No anon policy | **SAFE**: anon blocked |
| `communications` | No anon policy | **SAFE**: anon blocked |
| `contacts` | No anon policy | **SAFE**: anon blocked |

### Base-Table RLS Summary (authenticated exposure)
All 7 base tables have company-scoped authenticated policies using `get_user_company_id(auth.uid())`. **Authenticated access is properly tenant-isolated.**

## Step 3: Remaining Exposure After security_invoker

Two base-table anon policies create residual cross-tenant exposure through views:

1. **`customers` → `Allow anon read access for customers` (`USING(true)`)** — exposes `v_customers_clean`, `v_customer_company_map`, and through joins: `v_orders_enriched`, `v_deliveries_enriched`
2. **`leads` → `Allow anon read access for leads` (`USING(true)`)** — exposes `v_leads_enriched`

## Step 4: Next Fix SQL (Do Not Apply Yet)

```sql
-- Remove unsafe anon SELECT on customers
DROP POLICY "Allow anon read access for customers" ON public.customers;

-- Remove unsafe anon SELECT on leads
DROP POLICY "Allow anon read access for leads" ON public.leads;

-- Revoke anon privileges on views (defense in depth)
REVOKE ALL ON public.v_customers_clean FROM anon;
REVOKE ALL ON public.v_customer_company_map FROM anon;
REVOKE ALL ON public.v_orders_enriched FROM anon;
REVOKE ALL ON public.v_deliveries_enriched FROM anon;
REVOKE ALL ON public.v_leads_enriched FROM anon;
REVOKE ALL ON public.v_communications_enriched FROM anon;
REVOKE ALL ON public.profiles_safe FROM anon;
```

**WARNING**: Before dropping the anon customer/lead policies, verify whether any public-facing feature (e.g., customer portal widget, lead capture form, IoT device) depends on anonymous access. If so, those features need alternative authentication first.

## Summary

- **Applied**: 6 views get `security_invoker = true` (1 already done)
- **Remaining risks**: 2 anon `USING(true)` policies on `customers` and `leads` base tables
- **Next recommended fix**: Drop those 2 anon policies + revoke anon grants on all 7 views (pending review of public-facing dependencies)

