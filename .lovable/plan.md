
# Fix why "This quote is not linked to any sales lead" still appears

## What is actually happening
The error is real for this specific draft.

I checked the current draft shown in your screenshot:

- Quote number: `QE-DRAFT-G9QQZ`
- URL: `/sales/quotations?lead_id=b0bbd1fa-0742-4176-ba1a-5a59fdc2217c`
- Database value on the quote record: `lead_id = null`

So although the page URL contains the sales lead id, the quote record itself is still not linked. The Timeline button reads from the quote record, not from the URL, so it correctly shows the error.

## Root cause
The earlier fix only links `lead_id` when a new draft is created from the quotations page.

But this editor still has a gap:
- `DraftQuotationEditor.tsx` loads `lead_id` only from `quotes.lead_id`
- it does not read fallback `lead_id` from the URL
- `handleSave()` updates quote metadata, but does not persist `lead_id`

That means:
- old drafts created before the fix stay unlinked
- drafts opened directly in the editor can still show the error
- even if you came from pipeline and the URL has `lead_id`, the editor never writes that into the quote row

## Fix to implement

### 1) Update `DraftQuotationEditor.tsx`
Add `useSearchParams` and read `lead_id` from the URL.

Behavior:
- if `quotes.lead_id` exists, use it
- otherwise if URL has `lead_id`, use that as fallback
- set local `leadId` state from either source

### 2) Persist the link when saving
In `handleSave()`, also update:
```ts
lead_id: leadId || urlLeadId || null
```

This ensures the quote becomes permanently linked to the sales lead you came from.

### 3) Auto-persist the link on load for older drafts
When the editor opens:
- if quote has no `lead_id`
- but URL has `lead_id`
- immediately update that quote row once in the background

This repairs older broken drafts without waiting for manual Save.

### 4) Keep "Add to Timeline" using the saved quote link
No change to the Timeline insert logic is needed after the above fix.
It will work once `lead_id` is actually stored on the quote.

## Why this happened even after the previous fix
Because the previous fix solved only this path:

```text
Pipeline lead → Quotations page → Create new draft → save lead_id on insert
```

Your current failing draft is an existing quote record that was already saved with `lead_id = null`, so it never benefited from that creation-time fix.

## Files to change
- `src/components/accounting/documents/DraftQuotationEditor.tsx`

## Technical notes
- Current quote in DB: `QE-DRAFT-G9QQZ` has `lead_id = null`
- Current route already includes: `lead_id=b0bbd1fa-0742-4176-ba1a-5a59fdc2217c`
- Safe precedence should be:
```text
quotes.lead_id > URL lead_id > null
```
- This is a single-file fix and does not require database changes
