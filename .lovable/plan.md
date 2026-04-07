

# Fix: Inbound SMS Not Syncing — Root Cause Found

## Diagnosis Results

| Check | Result |
|-------|--------|
| CRON job running? | Yes — every 15 min, last at 04:00 |
| Integration status? | Connected, no errors shown |
| Last SMS in DB? | March 20, 2026 — **18 days ago** |
| SMS from +14165870788? | None (only outbound calls) |
| Webhook active? | No — zero recent webhook logs |
| SMS sync result? | **SILENTLY FAILING** |

## Root Cause

The account-level SMS endpoint returns **404**:
```
RC API error: 404 {"errorCode":"AGW-404","message":"Resource not found"}
URL: https://platform.ringcentral.com/restapi/v1.0/account/~/message-store?messageType=SMS
```

RingCentral's **account-level** `/account/~/message-store` endpoint is not available for this account (likely requires admin permissions or a different API tier). The per-extension endpoint (`/account/~/extension/~/message-store`) works fine — that's how the 132 SMS records from before were synced.

The CRON `syncAllUsers` function uses `fetchCompanyMessages` which calls the account-level endpoint. This fails silently because the error is caught on line 530: `catch (e) { console.warn(...) }`.

**This has been silently broken since the account-level sync was introduced.** No SMS or voicemail has synced since March 20.

## Fix

**File:** `supabase/functions/ringcentral-sync/index.ts`

Change the CRON SMS/voicemail/fax sync to use **per-extension endpoints** instead of account-level ones. The extension map is already built — iterate each extension and fetch their individual message stores.

### Specific Changes

1. **Replace `fetchCompanyMessages` calls in `syncAllUsers`** (lines 510-530, 534-557, 560-583):
   - Instead of calling the account-level `/account/~/message-store`, iterate through each extension in `extMap` and call `/account/~/extension/{extensionId}/message-store`
   - Use the existing `fetchMessages` function (line 227) which already targets the per-extension endpoint

2. **Add a helper `fetchExtensionMessages`** that takes an extensionId and fetches from `/restapi/v1.0/account/~/extension/{extensionId}/message-store`:
   ```typescript
   async function fetchExtensionMessages(
     accessToken: string, dateFrom: string, 
     extensionId: string, messageType: string
   ): Promise<any[]> {
     const params = new URLSearchParams({ dateFrom, perPage: "100", messageType });
     return fetchWithPagination(
       `${RC_SERVER}/restapi/v1.0/account/~/extension/${extensionId}/message-store?${params}`,
       accessToken
     );
   }
   ```

3. **Update SMS sync block** (~line 510-530): Loop through `extMap` entries, call `fetchExtensionMessages` for each extension with `messageType: "SMS"`

4. **Update Voicemail sync block** (~line 534-557): Same approach with `messageType: "VoiceMail"`

5. **Update Fax sync block** (~line 560-583): Same approach with `messageType: "Fax"`

6. **Improve error logging**: Change `console.warn` to `console.error` for these failures so they're more visible in logs

### Why This Works
- The per-extension endpoint (`/account/~/extension/{extId}/message-store`) is what worked before and synced the 132 SMS records
- The extension map is already built with all RC extensions mapped to user IDs
- The call log sync (`/account/~/call-log`) works at account level — only message-store doesn't

## Impact
- 1 file changed (`ringcentral-sync/index.ts`)
- ~40 lines modified (3 sync blocks + new helper function)
- Fixes 18-day-old silent SMS sync failure
- Inbound SMS from +14165870788 will appear after next sync
- No database or UI changes

