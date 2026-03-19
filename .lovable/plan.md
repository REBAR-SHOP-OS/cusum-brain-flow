

# Fix: Sync ALL Company RingCentral Calls (Not Just One User)

## Problem
The `ringcentral-sync` function currently fetches calls per-extension (`/account/~/extension/~/call-log`), meaning it only gets calls for the specific authenticated user's extension. Since only `sattar@rebar.shop` has a stored RC token, only his calls sync. The rest of the company's calls, SMS, voicemails, and faxes are missing.

## Solution
Use RingCentral's **account-level API** endpoints to fetch ALL extensions' data in one pass, using the admin JWT token. Then map each record to the correct employee by matching RC extension IDs to user profiles.

## Implementation

### 1. Add account-level fetch functions
- **New `fetchCompanyCallLog`**: calls `/account/~/call-log` (no `/extension/~`) — returns calls across ALL extensions
- **New `fetchCompanyMessages`**: calls `/account/~/message-store` — returns SMS/voicemail/fax across ALL extensions
- Both include `perPage: 250` and pagination support to get all records
- Each record returned includes an `extension` object with `id` and `extensionNumber`

### 2. Build extension-to-user mapping
- Fetch all company extensions from RC: `GET /account/~/extension` → list of extensions with email, name, extensionNumber
- Query `profiles` table for all users in the company
- Match RC extension email → profile email to build `extensionId → user_id` map
- Fallback: if no match found, attribute to the admin user (sattar)

### 3. Refactor `syncAllUsers` to use company-wide fetch
- Instead of looping per-user token and fetching per-extension:
  - Get one admin access token (from JWT or first available token)
  - Fetch ALL company calls/SMS/voicemail/fax in bulk
  - Map each record to the correct `user_id` using the extension map
  - Upsert into `communications` with proper `user_id` and `company_id`

### 4. Keep per-user sync as fallback
- The individual user sync path (when a user triggers sync from the UI) stays the same
- The CRON/company-wide path uses the new bulk approach

## File to update
- `supabase/functions/ringcentral-sync/index.ts`

## Technical details

**Key API change:**
```
# Before (per-extension, misses other employees)
GET /restapi/v1.0/account/~/extension/~/call-log

# After (account-level, gets ALL employees)
GET /restapi/v1.0/account/~/call-log
GET /restapi/v1.0/account/~/extension (to map extensions → users)
```

**Extension mapping flow:**
```text
RC API: /account/~/extension → [{id: 123, email: "radin@rebar.shop", ...}, ...]
DB: profiles → [{user_id: "abc", email: "radin@rebar.shop", company_id: "xyz"}, ...]
Map: extensionId 123 → user_id "abc"
```

**Pagination:** Account-level endpoints may return hundreds of records. Will implement cursor-based pagination using the `navigation.nextPage` URI returned by RC.

**Rate limiting:** Add 200ms delay between paginated requests to stay within RC API limits.

