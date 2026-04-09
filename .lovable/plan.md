

# Add to Timeline: Link Quotation to Sales Lead Timeline

## What It Does
When the user clicks "Add to Timeline" in the Draft Quotation Editor, it inserts a new activity entry into the associated sales lead's timeline — visible under the "Timeline" tab in the Sales Lead Drawer.

## How It Works

### File: `src/components/accounting/documents/DraftQuotationEditor.tsx`

1. **Store `lead_id`** from the loaded quote data (the `quotes` table already has a `lead_id` column):
   - Add state: `const [leadId, setLeadId] = useState<string | null>(null)`
   - In the load function after line 135: `setLeadId(data.lead_id || null)`

2. **Replace the placeholder toast** on the "Add to Timeline" button (line 435) with actual logic:
   - If `leadId` exists: insert into `sales_lead_activities` with `activity_type: "quotation"`, subject like `"Quotation #QE-DRAFT-xxx added to timeline"`, and body with the total amount
   - If no `leadId`: show a toast error saying "This quote is not linked to any sales lead"
   - On success: show success toast

3. **Activity insert** follows the existing pattern from `GenerateQuotationDialog.tsx`:
   ```ts
   await supabase.from("sales_lead_activities").insert({
     sales_lead_id: leadId,
     company_id: companyId,
     activity_type: "quotation",
     subject: `Quotation ${quoteNumber} added to timeline`,
     body: `Draft quotation. Total: $${total.toLocaleString()}`,
     user_id: user?.id,
     user_name: user?.email || "User",
     completed_at: new Date().toISOString(),
   });
   ```

## No Database Changes
- `quotes.lead_id` already exists
- `sales_lead_activities` table already supports this activity type
- No migrations needed

## Single file change: `DraftQuotationEditor.tsx`

