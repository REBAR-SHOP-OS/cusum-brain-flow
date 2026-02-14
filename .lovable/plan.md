

# Fix Remaining "No QuickBooks ID" Warnings

## Root Cause

Three different issues are causing these warnings:

1. **Duplicate local records**: "Clearway Construction Inc." and "VALARD CONSTRUCTION LP" each have TWO rows in the database -- one already linked to QuickBooks, one not. The auto-match skips these because assigning the same QB ID to a second row would create duplicates.

2. **Name variations**: Several unlinked rows are contact-specific entries like "Valard Construction LP, Mitchell Lewis" or "Valard Construction LP (Mitch Miller)" which don't match the QB name exactly.

3. **No QB record**: "Rigarus Construction inc" simply doesn't exist in QuickBooks at all, so no auto-match is possible.

## Solution

### 1. Improve auto-match with fuzzy/partial matching

Enhance the name-matching logic in `handleSyncCustomers` to also check if a local customer name **starts with** or **contains** a QB customer name. This handles the "Valard Construction LP, Nick Dong" pattern where the base company name is a prefix.

### 2. Skip already-linked QB IDs

Before assigning a QB ID to an unlinked row, check if that QB ID is already used by another local customer. If it is, skip (don't create duplicate links). This prevents the duplicate Clearway/Valard rows from both getting the same QB ID.

### 3. Merge duplicate customer records (data cleanup)

The real fix for Clearway and Valard is that the duplicate unlinked rows should be merged into the linked ones. We'll add logic: if an unlinked customer has the exact same normalized name as a linked customer, skip it and log it as a "duplicate detected" rather than a warning.

### 4. Handle Rigarus -- no QB match

For customers like Rigarus that genuinely don't exist in QB, suppress the warning in the suggestions generator since the customer simply hasn't been created in QuickBooks yet. Change the suggestion severity from "warning" to "info" for customers that have no plausible QB match.

## Technical Details

### File: `supabase/functions/quickbooks-oauth/index.ts`

**Enhance name-matching in `handleSyncCustomers`** (lines 677-715):

- Build a set of QB IDs that are already linked to a local customer (query `customers` where `quickbooks_id IS NOT NULL`)
- When matching, skip any QB ID already in that set
- Add prefix/contains matching: if exact match fails, check if any QB name is a prefix of the local name (handles "Valard Construction LP, Nick Dong" matching to "Valard Construction LP")
- Log duplicates separately for visibility

```text
Matching priority:
1. Exact normalized match (current behavior)
2. QB name is a prefix of local name (new)
3. Skip if QB ID already assigned to another row (new guard)
```

### File: `supabase/functions/quickbooks-oauth/index.ts` (suggestions generator, if applicable)

**Or the file that generates suggestions** -- adjust the severity:

- If a customer has no QB ID but there's a linked customer with a similar name, mark as "info" (duplicate) instead of "warning"
- If a customer has no QB ID and no similar QB customer exists, keep as "info" with action "Create in QuickBooks" instead of the current alarming warning

### Result

- Valard contact-specific entries (Mitchell Lewis, Nick Dong, Mitch Miller) get auto-linked to QB ID 1821 via prefix matching
- Clearway duplicate is detected and skipped (won't create a duplicate QB link)
- Rigarus warning is softened since it genuinely needs to be created in QB first
- Fewer false-alarm warnings on the dashboard

