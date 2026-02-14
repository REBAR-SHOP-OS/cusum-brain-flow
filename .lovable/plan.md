

# Add Odoo Activity Assignments to Lead Timelines

## Context

Five emails from OdooBot and Saurabh Sehgal assigned Odoo activities to leads. Each corresponds to an existing lead in the pipeline. None of these leads currently have any timeline entries.

## Activities to Add

| Email Subject | Lead | Stage | Activity |
|---|---|---|---|
| Alexandria Lagoon Expansion Addendum 03: Chk new lead moved to CRM stages | Alexandria Lagoon Expansion Invitation to Bid | qualified | "Check new lead moved to CRM stages" (assigned by OdooBot) |
| ISIDRO PAYAKET (SHANWELL): Just Chk | ISIDRO PAYAKET (SHANWELL CONTRACTING LTD.)'s opportunity | won | "Just Chk" (assigned by Saurabh Sehgal) |
| 15 MM straight: Just Chk | 15 MM straight | won | "Just Chk" (assigned by Saurabh Sehgal) |
| 18" ties and 6'straights: Just Chk | 18" ties and 6'straights | won | "Just Chk" (assigned by Saurabh Sehgal) |
| Cage Request - Alamos Gold: Chk reason for loss | FW: Cage Request - Alamos Gold - 4' deep x 4' wide x 7' long Cages - VPL Gates | lost | "Check reason for loss" (assigned by Saurabh Sehgal) |

## Technical Steps

1. **Insert 5 `lead_activities` rows** via a database migration, one for each Odoo assignment:
   - `activity_type`: `"internal_task"`
   - `title`: The assignment summary (e.g., "Chk new lead moved to CRM stages")
   - `description`: Full context from email including who assigned it and deadline
   - `created_by`: `"OdooBot"` or `"Saurabh Sehgal"` as appropriate
   - `due_date`: `2026-02-13` (the Odoo deadline from the emails)
   - `company_id`: `a0000000-0000-0000-0000-000000000001`
   - `metadata`: `{ "source": "odoo_activity", "odoo_assigned_by": "..." }`

2. **No code changes needed** -- the existing `LeadTimeline` component already renders `lead_activities` entries with the `internal_task` type (shows as a document icon with muted styling).

3. These will immediately appear in each lead's Timeline tab in the Lead Detail Drawer.

