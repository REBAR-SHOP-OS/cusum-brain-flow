

# Fix: Add PKCE Support to RingCentral OAuth

## Root Cause
Your RingCentral app is configured as a **"Client-side web app"**, which **requires PKCE** (Proof Key for Code Exchange). The current edge function does not generate or send PKCE parameters, causing RingCentral to reject the token exchange with a misleading "Redirect URIs do not match" error.

## Fix (1 file)

### `supabase/functions/ringcentral-oauth/index.ts`

**In `get-auth-url` action:**
- Generate a random `code_verifier` (43-128 character string)
- Compute `code_challenge` = base64url(SHA-256(code_verifier))
- Add `code_challenge` and `code_challenge_method=S256` to the authorization URL
- Store the `code_verifier` in the database (`user_ringcentral_tokens` table) so it can be retrieved during the token exchange step

**In `exchange-code` action:**
- Retrieve the stored `code_verifier` for the user
- Include `code_verifier` in the token exchange POST body

### Database
- Add a nullable `code_verifier` column to `user_ringcentral_tokens` to temporarily hold the PKCE verifier between the two steps

## Technical Details

The PKCE flow works like this:

1. **Auth URL** -- Generate a random string (code_verifier), hash it (code_challenge), and send the challenge with the auth URL
2. **Token Exchange** -- Send the original code_verifier so RingCentral can verify it matches the challenge

This is a standard OAuth security requirement for client-side/SPA applications.

## No Other Changes Needed
- The redirect URIs in your RingCentral portal are already correct
- The frontend code does not need changes
- The callback page already handles `ringcentral` state

