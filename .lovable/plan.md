
# Auto-Match Customers to QuickBooks by Name

## What Changes

After syncing customers from QuickBooks, the system will automatically find local customers that have no QuickBooks ID and try to match them to QB customers by name. When a match is found, the local customer gets linked to the QB record, eliminating the "cannot be synced" warnings.

## How It Works

1. QB customers sync as normal (upsert by `quickbooks_id`)
2. After that, load all local customers where `quickbooks_id IS NULL`
3. Build a lookup map from QB customer `DisplayName` (lowercased, trimmed) to their QB `Id`
4. For each unlinked local customer, normalize their `name` and check for a match
5. If matched, update the local customer's `quickbooks_id` to link them
6. Report how many were auto-matched

## Technical Details

### File: `supabase/functions/quickbooks-oauth/index.ts`

**Modify `handleSyncCustomers`** (lines 643-679):

After the existing upsert loop, add a name-matching phase:

- Query all customers from the database where `quickbooks_id IS NULL` and `company_id = companyId`
- Build a `Map<string, string>` from normalized QB `DisplayName` to QB `Id` (using the already-fetched `customers` array)
- Also check `CompanyName` as a secondary match key
- For each unlinked local customer, normalize their `name` and look up in the map
- If found, update that row's `quickbooks_id`
- Track and return `matched` count alongside `synced`

Normalization: lowercase, trim whitespace, collapse multiple spaces -- simple but effective for business names.
