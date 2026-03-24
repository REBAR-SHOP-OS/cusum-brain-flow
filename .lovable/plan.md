

## Upgrade Sales Pipeline "New Sales Lead" Dialog to Match Main Pipeline's "Add Lead" Dialog

### What
The "New Sales Lead" dialog in `/sales` is a simple form with only 6 fields (Title, Contact Name, Company, Email, Phone, Expected Value, Source, Notes). The main Pipeline's `LeadFormModal` has a full-featured form with Stage, Priority, Lead Type, Source (dropdown), Expected Value, Probability, Expected Close Date, Assigned To, Territory, Description, and Notes. We need to make the Sales dialog match.

### Changes

**File**: `src/pages/sales/SalesPipeline.tsx`

Replace the inline create dialog (lines 245-306) with a full form matching `LeadFormModal`'s layout:

1. **Title** — text input (keep)
2. **Contact Name** — keep existing combobox with unified contacts (this replaces "Customer" dropdown since sales_leads uses inline contact fields)
3. **Stage + Priority** — 2-col row with Select dropdowns (using `SALES_STAGES`)
4. **Lead Type + Source** — 2-col row; Lead Type = Opportunity/Lead; Source = dropdown with Email, Phone/Call, Website, Referral, Trade Show, Social Media, Cold Outreach, Partner, Other
5. **Expected Value + Probability** — 2-col row, number inputs
6. **Expected Close Date** — full-width date input
7. **Assigned To + Territory** — 2-col row, text inputs
8. **Description** — textarea (3 rows)
9. **Notes** — textarea (2 rows)
10. **Footer** — Cancel + Create buttons

Add new fields to the form state: `stage`, `priority`, `probability`, `expected_close_date`, `lead_type`, `assigned_to`, `territory`, `description`. Pass all to `createLead.mutate()`.

### Files Changed

| File | Change |
|---|---|
| `src/pages/sales/SalesPipeline.tsx` | Expand create dialog with all fields matching LeadFormModal layout |

