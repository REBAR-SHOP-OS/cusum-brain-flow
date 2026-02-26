

# R16 Integration Fixes -- Implementation Plan

## What the screenshot shows

You're on the QuickBooks Developer portal's webhook endpoint setup page. Two things need to happen:

1. **Endpoint URL**: Set it to your backend function URL:
   `https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/qb-webhook`

2. **Verifier Token**: QuickBooks will show you a verifier token when you toggle "Show verifier token". You need to copy that token and store it as a secret so the webhook can respond to QuickBooks validation requests.

---

## Step 1: Store the QuickBooks verifier token as a secret

- Use the secret storage tool to request `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` from you
- The code in `qb-webhook/index.ts` already reads this secret (line 24) and returns it for GET validation requests (line 28)
- Once stored, QuickBooks can verify your endpoint

## Step 2: R16-1 (HIGH) -- Add HMAC signature verification on POST

QuickBooks signs every POST webhook payload with an HMAC-SHA256 using the verifier token. The current code ignores the `intuit-signature` header entirely.

**Changes to `supabase/functions/qb-webhook/index.ts`:**
- After parsing the JSON body, read the `intuit-signature` header
- Compute HMAC-SHA256 of the raw request body using `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` as the key
- Compare the computed signature with the header value
- Reject with 401 if they don't match
- This prevents spoofed webhook events from triggering sync operations

## Step 3: R16-2 (MEDIUM) -- Add replay/dedup protection

**Changes to `supabase/functions/qb-webhook/index.ts`:**
- Before inserting into `qb_webhook_events`, check if a record with the same `realm_id + entity_type + entity_id + operation` already exists and was processed recently (within 60 seconds)
- If duplicate, skip the sync trigger but still return 200
- Use upsert with `onConflict` or a pre-check query

## Step 4: R16-3 (MEDIUM) -- Gmail webhook error differentiation

**Changes to `supabase/functions/gmail-webhook/index.ts` line 300-304:**
- Currently the catch block always returns 200, even on transient errors
- Change to: return 200 only for permanent/application errors (bad data, missing user)
- Return 500 for transient errors (DB connection failure, decryption failure) so Pub/Sub retries
- Add error classification logic in the catch block

## Step 5: R16-4 (LOW) -- Pipeline webhook retry on failure

**Changes to `supabase/functions/pipeline-webhooks/index.ts`:**
- After a failed delivery (non-2xx response or network error), schedule a retry
- Simple approach: insert a record into a `pipeline_webhook_retry_queue` table with backoff metadata
- Or: immediate single retry with 5-second delay before giving up
- Log all failures with response status for debugging

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/qb-webhook/index.ts` | HMAC verification + dedup guard |
| `supabase/functions/gmail-webhook/index.ts` | Error classification in catch block |
| `supabase/functions/pipeline-webhooks/index.ts` | Single retry on failed delivery |

## Secret Required

- `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` -- copy from QuickBooks Developer portal when you toggle "Show verifier token"

## QuickBooks Setup Instructions

1. In the QuickBooks Developer portal webhook setup page (your screenshot):
   - **Endpoint URL**: `https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/qb-webhook`
   - Toggle **Show verifier token** and copy the token value
2. I will store that token as a secret
3. Click Save in QuickBooks -- it will send a GET request to validate the endpoint
4. Once validated, QuickBooks will send signed POST events to your endpoint

