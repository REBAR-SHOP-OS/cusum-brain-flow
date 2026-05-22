# Build the "Office Clearances" feature

## Context check (important)

- The original "fix" prompt was a **false positive** — nothing in the codebase queries `office_clearances`, and the `/office` screenshot you sent shows the normal AI Extract loading state, not an error.
- The word "clearance" is already used in this project for the **manufacturing QC step** (`cut_plan_items` + `clearance_evidence`, governed by the Production Flow Governance rule). To avoid colliding with that domain concept, this new feature is scoped explicitly as **Office Clearances** — office-side sign-offs on extract sessions / orders (e.g. estimation approved, pricing approved, customer notified).

If that's not what you mean by "clearance", stop here and clarify before I implement.

## Scope

1. New table `public.office_clearances` with RLS.
2. New hook `useOfficeClearances`.
3. New view `OfficeClearancesView` added to `OfficePortal` sidebar.
4. No change to existing manufacturing clearance flow.

## Database (single migration)

```sql
create type public.office_clearance_status as enum ('pending','approved','rejected');

create table public.office_clearances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,                  -- multi-tenant scoping (Core rule)
  session_id uuid references public.extract_sessions(id) on delete cascade,
  order_id uuid,                             -- optional link to orders
  title text not null,
  notes text,
  status public.office_clearance_status not null default 'pending',
  requested_by uuid not null,                -- auth.uid()
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.office_clearances (company_id, status);
create index on public.office_clearances (session_id);

alter table public.office_clearances enable row level security;

-- Strict company_id scoping via existing helper get_user_company_id()
create policy "select own company" on public.office_clearances
  for select using (company_id = public.get_user_company_id());
create policy "insert own company" on public.office_clearances
  for insert with check (company_id = public.get_user_company_id() and requested_by = auth.uid());
create policy "update own company (office/admin)" on public.office_clearances
  for update using (
    company_id = public.get_user_company_id()
    and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'office'))
  );
create policy "delete admin only" on public.office_clearances
  for delete using (
    company_id = public.get_user_company_id() and public.has_role(auth.uid(),'admin')
  );

create trigger trg_office_clearances_updated_at
  before update on public.office_clearances
  for each row execute function public.update_updated_at_column();
```

Notes:
- Uses existing `get_user_company_id()` + `has_role()` helpers (consistent with RLS Standards memory).
- No FK to `auth.users` (per project rule).
- No CHECK constraints with non-immutable expressions.

## Frontend

1. **`src/hooks/useOfficeClearances.ts`** — list/create/approve/reject with realtime subscription scoped by `company_id` (unique channel id).
2. **`src/components/office/OfficeClearancesView.tsx`** — table of clearances grouped by status, with Approve / Reject actions for office+admin roles.
3. **`src/components/office/OfficeSidebar.tsx`** — add `"office-clearances"` to `OfficeSection` union + sidebar entry (icon: `ShieldCheck`).
4. **`src/pages/OfficePortal.tsx`** — register `"office-clearances": OfficeClearancesView` in `sectionComponents`.

No changes to: routing, existing views, manufacturing clearance code, or auth.

## Out of scope

- Email/SMS notifications on approval.
- Workflow gates blocking other modules until approved.
- Bulk approve.

Tell me yes to implement, or correct the scope (especially what an "office clearance" represents in your workflow) and I'll revise.