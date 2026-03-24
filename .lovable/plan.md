

## Multi-Assignee Support + External Estimator Visibility

### What
1. Each lead in both Pipelines gets **multiple assignees** via junction tables
2. External estimators see **only leads where they are assigned** — across any column, not just their designated stage
3. If assigned to a "Shop Drawing" lead, they see that column and that lead

### Database Changes (Migration)

```sql
CREATE TABLE public.lead_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, profile_id)
);
ALTER TABLE public.lead_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage lead assignees"
  ON public.lead_assignees FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE TABLE public.sales_lead_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sales_lead_id, profile_id)
);
ALTER TABLE public.sales_lead_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage sales lead assignees"
  ON public.sales_lead_assignees FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
```

### Code Changes

**`src/hooks/useSalesLeads.ts`**
- Extend `SalesLead` type with `assignees: { profile_id: string; full_name: string }[]`
- Fetch `sales_lead_assignees(profile_id, profiles(full_name))` alongside each lead
- Add `addSalesLeadAssignee` and `removeSalesLeadAssignee` mutations

**`src/hooks/useLeads.ts`** (main pipeline)
- Same pattern: extend lead type with assignees array
- Fetch `lead_assignees(profile_id, profiles(full_name))`
- Add `addLeadAssignee` / `removeLeadAssignee` mutations

**`src/pages/sales/SalesPipeline.tsx`**
- Replace single `assigned_to` Select with multi-select checkbox dropdown using active profiles
- On create: insert into `sales_lead_assignees` for each selected profile
- **External estimator visibility**: Instead of filtering by stage only, find the estimator's profile ID from their email, then:
  - Show **only** leads where their profile ID is in `sales_lead_assignees`
  - Dynamically derive visible columns from the stages of those assigned leads (not hardcoded to "estimation_karthick")
  - This means if Karthick is assigned to a "shop_drawing" lead, the shop_drawing column appears

**`src/components/pipeline/LeadFormModal.tsx`**
- Replace single `assigned_to` Select with multi-select checkbox dropdown
- On save: sync `lead_assignees` junction table (delete old + insert new)

**`src/components/pipeline/LeadCard.tsx`**
- Update `getSalesperson()` to accept an optional `assignees` array prop
- Show stacked avatars for multiple assignees (max 3, then "+N")

**`src/components/sales/SalesLeadDrawer.tsx`**
- Add assignee chips section with add/remove buttons using active profiles dropdown

**`src/components/pipeline/LeadDetailDrawer.tsx`**
- Same assignee management UI as SalesLeadDrawer

### External Estimator Visibility Logic (key change)

```typescript
// In SalesPipeline.tsx
if (isExternalEstimator) {
  // Find estimator's profile ID by email
  const myProfileId = profiles?.find(p => p.email === userEmail)?.id;
  // Filter leads to only those where estimator is assigned
  const myLeads = leads.filter(l => 
    l.assignees?.some(a => a.profile_id === myProfileId)
  );
  // Derive visible columns from those leads' stages
  const myStageIds = [...new Set(myLeads.map(l => l.stage))];
  // Use myStageIds as visibleStageIds, show only myLeads
}
```

### Files Changed

| File | Change |
|---|---|
| Migration | Create `lead_assignees` + `sales_lead_assignees` tables |
| `src/hooks/useSalesLeads.ts` | Fetch assignees, add/remove mutations |
| `src/hooks/useLeads.ts` | Fetch assignees, add/remove mutations |
| `src/pages/sales/SalesPipeline.tsx` | Multi-select, external estimator shows only assigned leads + their columns |
| `src/components/pipeline/LeadFormModal.tsx` | Multi-select assignee dropdown |
| `src/components/pipeline/LeadCard.tsx` | Stacked assignee avatars |
| `src/components/sales/SalesLeadDrawer.tsx` | Assignee management chips |
| `src/components/pipeline/LeadDetailDrawer.tsx` | Assignee management chips |

