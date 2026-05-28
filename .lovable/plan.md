Root cause found:

- The current LinkedIn connection is expired.
- It has no `refresh_token`, so the backend cannot auto-refresh it.
- The stored scopes are only `email, openid, profile, w_member_social`.
- Missing scopes are `offline_access`, `w_organization_social`, and `r_organization_social`.
- The latest LinkedIn reconnect attempt fails at LinkedIn itself with `invalid_scope_error`, which means the LinkedIn app is not approved/configured for the requested company-page scopes.
- No LinkedIn company pages were discovered, so company-page publishing cannot work until the app has the required LinkedIn products and the connection is re-authorized.

Plan to fix safely:

1. Make reconnect deterministic instead of broken
   - Update `linkedin-oauth` so it does not always request organization scopes when the LinkedIn app rejects them.
   - Add a safe fallback OAuth mode for personal LinkedIn publishing using the scopes that are already valid: `openid profile email w_member_social`.
   - Preserve the stricter company-page path only when company-page scopes are available.

2. Stop publish-time noise and repeated failed attempts
   - Update `social-publish` so expired/no-refresh LinkedIn connections fail before trying multiple page publishes.
   - Return one clean, actionable error instead of repeating the same message for every LinkedIn page.

3. Improve UI recovery
   - Update the publish hook so LinkedIn failures show a clear message:
     - personal posting can be reconnected now
     - company-page posting needs LinkedIn app approval for Community Management / organization scopes
   - Keep the existing Reconnect flow but avoid opening an OAuth URL that LinkedIn will reject with `invalid_scope_error`.

4. Validate with real signals
   - Call `linkedin-oauth` check-status after the code change.
   - Test the auth-url generation path for the fallback scope mode.
   - Call `social-publish` on a LinkedIn post path enough to confirm it returns the cleaned single error instead of repeated page errors.
   - Check edge function logs after testing.

Important limitation:

- Code can make personal LinkedIn posting reconnectable again.
- Code cannot force LinkedIn to grant company-page permissions. To publish to company pages like `Rebar.shop Ontario`, the LinkedIn Developer App must be approved for organization/community permissions, then LinkedIn must be reconnected.