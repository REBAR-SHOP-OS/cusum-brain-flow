

## Upgrade Sales Lead Drawer to Match Pipeline Detail Template

### What
Rebuild `SalesLeadDrawer` to match the Pipeline's `LeadDetailDrawer` layout — with stage ribbon, contact grid, timeline/details tabs, log notes, activity scheduling, and a proper footer with delete confirmation.

### Current State
- **Pipeline drawer** (`LeadDetailDrawer.tsx`, 546 lines): Rich Odoo-style layout with stage breadcrumb ribbon, contact info grid, AI scoring, "Next Best Action", Timeline/Details tabs, OdooChatter (log note + send message + schedule activity), files, activities, and a footer with timestamps + delete confirmation dialog.
- **Sales drawer** (`SalesLeadDrawer.tsx`, 169 lines): Simple form with dropdowns, text inputs, and a delete button. No timeline, no activity logging, no tabs.

### Plan

**File**: `src/components/sales/SalesLeadDrawer.tsx` — Full rewrite

1. **Header**: Title + edit/close buttons, priority badge, age badge
2. **Stage Ribbon**: Clickable breadcrumb-style stage buttons using `SALES_STAGES` (same pattern as Pipeline's `PIPELINE_STAGES` ribbon)
3. **Info Grid**: Customer name, company, email (clickable mailto), phone (clickable tel), expected value, source — label-above-value layout
4. **Tabs**: "Timeline" and "Details" tabs
   - **Timeline tab**: Embed a new `SalesLeadChatter` component (simplified version of OdooChatter) that:
     - Has "Log note" / "Send message" / "Schedule activity" action buttons
     - Shows a chronological feed of notes/activities from a `sales_lead_activities` table
     - Supports "All" / "Notes" / "System" sub-filters
   - **Details tab**: Notes textarea, description, lost reason (when stage=lost)
5. **Footer**: Created/Updated timestamps + Delete with AlertDialog confirmation

**New file**: `src/components/sales/SalesLeadChatter.tsx`
- Simplified chatter for sales leads
- Log note: saves to `sales_lead_activities` table with type "note"
- Schedule activity: date picker + type selector, saves as type "activity"
- Displays activity feed with avatars, timestamps, icons

**Database migration**: Create `sales_lead_activities` table
```sql
CREATE TABLE public.sales_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  activity_type text NOT NULL DEFAULT 'note', -- note, call, email, meeting, stage_change, system
  subject text,
  body text,
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  scheduled_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company activities"
  ON public.sales_lead_activities FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
```

### Files Changed

| File | Change |
|---|---|
| `src/components/sales/SalesLeadDrawer.tsx` | Full rewrite: Odoo-style layout with stage ribbon, info grid, tabs, footer |
| `src/components/sales/SalesLeadChatter.tsx` | New: Timeline chatter with log note, schedule activity, activity feed |
| Database migration | New `sales_lead_activities` table with RLS |

