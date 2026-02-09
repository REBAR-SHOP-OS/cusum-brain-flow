

# Update RingCentral OAuth Secrets

The "URL blocked" error is most likely caused by a mismatch between the stored `RINGCENTRAL_CLIENT_ID` secret and your production app's Client ID. Your credentials file confirms the correct production values.

## What will be done

Update the following secrets to match your production RingCentral app:

1. **RINGCENTRAL_CLIENT_ID** -- set to `99KxuQlTa6aepPopPBwkd3`
2. **RINGCENTRAL_CLIENT_SECRET** -- set to the value from your credentials file
3. **RINGCENTRAL_JWT** -- update to the JWT token from your credentials file (used as fallback for matching users)

No code changes are needed -- the edge function is already correctly implemented with PKCE support. Once the secrets match your production app, the OAuth flow should work.

