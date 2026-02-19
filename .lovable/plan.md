
# Fix: Convert Status, Priority, and Type to Dropdown Selects on /pipeline

## Investigation Summary

After a thorough review of the pipeline codebase, here is the current state of the three fields in question:

### Current Field State in `LeadFormModal.tsx`

| Field | Current Control | Problem |
|---|---|---|
| Priority | `Select` dropdown (Low / Medium / High) | Already correct, but the user reports it as a text field — may be a display issue or they expect more options |
| Source | Plain text `Input` | This free-text field likely maps to what the user calls "Type" |
| Stage | `Select` dropdown | Already correct |

### What Is Missing

The `leads` table has no `status` or `type` columns. Looking at Odoo CRM conventions:

- **Type** in Odoo = "Lead" vs "Opportunity" (a pipeline concept stored in the `type` key in `metadata`)
- **Status** in Odoo = "Active" / "Won" / "Lost" (effectively the `stage` or a sub-status within a stage)

The `Source` field is currently a free-text `<Input>` and should be a `<Select>` dropdown with predefined common values (Email, Phone, Referral, Website, Trade Show, etc.).

### Root Cause

The user is seeing the `Source` field as a free-text box and wants it as a dropdown ("Type"), and the `Priority` field -- while already a Select -- may not be rendering correctly (it currently only shows Low / Medium / High which is correct per Odoo's star system).

## Exact Plan — Surgical, Scoped to `LeadFormModal.tsx` Only

### Change 1: Convert `Source` field from plain `Input` to a `Select` dropdown

The `Source` field will become a labeled `Select` with predefined values matching common CRM sources, plus an "Other" option to preserve backward compatibility. The field label will remain "Source" (not "Type") since that is the actual database column name.

Predefined source options:
- Email
- Phone / Call
- Website
- Referral
- Trade Show
- Social Media
- Cold Outreach
- Partner
- Other

### Change 2: Add a "Lead Type" dropdown field to the form

A new `lead_type` field stored in the existing `metadata` JSONB column (no DB schema change needed). Options:
- Opportunity
- Lead

This mirrors Odoo CRM behavior where pipeline entries can be classified as "Lead" (early stage, not yet qualified) or "Opportunity" (qualified and actively being pursued).

### Change 3: Confirm Priority dropdown is correct

Priority is already a Select with Low / Medium / High. No change needed — it is already correct.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/pipeline/LeadFormModal.tsx` | Convert Source Input to Select; add Lead Type dropdown reading/writing from metadata |

**Only one file is touched. No database schema changes. No other UI elements. No other components.**

---

## Technical Details

### Source Dropdown (replaces `Input` on line ~292-303)

```tsx
<FormField
  control={form.control}
  name="source"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Source</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || ""}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select source..." />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="Email">Email</SelectItem>
          <SelectItem value="Phone / Call">Phone / Call</SelectItem>
          <SelectItem value="Website">Website</SelectItem>
          <SelectItem value="Referral">Referral</SelectItem>
          <SelectItem value="Trade Show">Trade Show</SelectItem>
          <SelectItem value="Social Media">Social Media</SelectItem>
          <SelectItem value="Cold Outreach">Cold Outreach</SelectItem>
          <SelectItem value="Partner">Partner</SelectItem>
          <SelectItem value="Other">Other</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Lead Type Dropdown (new field added to schema and form)

The form schema (`formSchema`) will be extended with an optional `lead_type` field. On form submit, it will be written to `metadata.lead_type`. On edit load, it will be read from `lead.metadata?.lead_type`.

```tsx
// Schema addition
lead_type: z.string().optional(),

// In form defaultValues
lead_type: (lead?.metadata as Record<string,unknown>)?.lead_type as string || "opportunity",

// In mutation payload
metadata: { ...existingMeta, lead_type: data.lead_type },

// In form JSX (added alongside Priority in the grid)
<FormField name="lead_type" render={...}>
  <Select>
    <SelectItem value="opportunity">Opportunity</SelectItem>
    <SelectItem value="lead">Lead</SelectItem>
  </Select>
</FormField>
```

## What Is NOT Changed

- `src/pages/Pipeline.tsx` — untouched
- `src/components/pipeline/LeadDetailDrawer.tsx` — untouched
- `src/components/pipeline/LeadCard.tsx` — untouched
- `src/components/pipeline/PipelineColumn.tsx` — untouched
- `src/components/pipeline/PipelineBoard.tsx` — untouched
- Database schema — untouched (lead_type stored in existing `metadata` JSONB)
- All other pages and components — untouched
