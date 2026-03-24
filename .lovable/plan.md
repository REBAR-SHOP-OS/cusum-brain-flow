

## Auto-Link Communications to Sales Lead Timelines + Co-Assignee on Activities

### What This Does
1. **Auto-link calls and emails**: After the RingCentral sync and Gmail sync store communications, a new background step matches them to sales leads by phone number, email address, or project name (100% exact match only). Matched communications are automatically inserted into the lead's activity timeline (`sales_lead_activities`).
2. **Co-assignee on scheduled activities**: Add an "Assign to" dropdown in the Schedule Activity form so any team member can be assigned, not just the current user.

---

### Part 1: Auto-Link Communications to Lead Timeline

**Database**: Create a function + trigger that runs after each `INSERT` on `communications`. It looks up `sales_leads` for an exact match on `contact_phone` or `contact_email` (matching against `from_address`/`to_address`), and if found, inserts a record into `sales_lead_activities` with the communication details.

```sql
-- Function: auto-link communications to sales leads
CREATE OR REPLACE FUNCTION public.auto_link_comm_to_lead()
RETURNS trigger AS $$
DECLARE
  lead RECORD;
  clean_from TEXT;
  clean_to TEXT;
BEGIN
  -- Normalize phone numbers (strip spaces, dashes, parens)
  clean_from := regexp_replace(NEW.from_address, '[^0-9+]', '', 'g');
  clean_to := regexp_replace(NEW.to_address, '[^0-9+]', '', 'g');

  -- Match by phone or email (100% exact match)
  FOR lead IN
    SELECT id, company_id, title FROM public.sales_leads
    WHERE company_id = NEW.company_id
      AND (
        regexp_replace(contact_phone, '[^0-9+]', '', 'g') IN (clean_from, clean_to)
        OR lower(contact_email) IN (lower(NEW.from_address), lower(NEW.to_address))
      )
  LOOP
    INSERT INTO public.sales_lead_activities
      (sales_lead_id, company_id, activity_type, subject, body, user_id, user_name)
    VALUES (
      lead.id, lead.company_id,
      CASE WHEN (NEW.metadata->>'type') = 'call' THEN 'call' ELSE 'email' END,
      NEW.subject,
      NEW.body_preview,
      NEW.user_id,
      'Auto-linked'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on communications table
CREATE TRIGGER trg_auto_link_comm_to_lead
  AFTER INSERT ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_comm_to_lead();
```

This is fully server-side -- no frontend changes needed. Every synced call/email that matches a lead's phone or email will appear in the Timeline automatically.

---

### Part 2: Co-Assignee on Scheduled Activities

**File**: `src/components/pipeline/ScheduledActivities.tsx`
- Add an "Assign to" `Select` dropdown in the create form populated from the lead's assignees (passed as a new `assignees` prop)
- Pass `assigned_name` to the `createActivity` mutation
- Display the assigned person's name on each activity card

**File**: `src/hooks/useScheduledActivities.ts`
- Already supports `assigned_name` and `assigned_to` fields -- no hook changes needed

**File**: `src/components/sales/SalesLeadDrawer.tsx`
- Pass `assignees` prop to `ScheduledActivities` component

**File**: `src/components/pipeline/ScheduledActivities.tsx` (display)
- Show assigned name badge on each planned activity item

---

### Summary

| Area | Change |
|---|---|
| DB Migration | Trigger function `auto_link_comm_to_lead` on `communications` INSERT |
| `ScheduledActivities.tsx` | Add assignee selector in create form, show assignee on cards |
| `SalesLeadDrawer.tsx` | Pass assignees to ScheduledActivities |

