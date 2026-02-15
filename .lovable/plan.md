

# Update WordPress Application Password

## What Needs to Happen

1. **You generate a new Application Password** in WordPress admin:
   - Go to `rebar.shop/wp-admin` > Users > Your Profile > Application Passwords
   - Revoke the old one (if still listed)
   - Create a new one (name it "Lovable AI" or similar)
   - Copy the password immediately (WordPress only shows it once)

2. **Provide the new password to Lovable** -- I will use the secure secret update tool to replace the current `WP_APP_PASSWORD` value

3. **Verify connectivity** -- I will call the `wp-test` edge function to confirm the new credential works

## No Code Changes Required

The existing `wpClient.ts` and all edge functions already read `WP_APP_PASSWORD` from the environment. Only the secret value needs replacing -- no file edits needed.

## After Update

Seomi and all other WordPress/WooCommerce integrations (JARVIS, wp-test, etc.) will immediately use the new credential on their next request.

