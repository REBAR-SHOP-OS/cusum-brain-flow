

## Connect rebar.shop WordPress/WooCommerce Integration

**Problem**: The rebar.shop card shows "available" (disconnected) even though all WP credentials (`WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`) are already stored as secrets. There's no status check handler for the `rebar-shop` integration in `useIntegrations.ts`.

### Changes

**1. `src/hooks/useIntegrations.ts`**

- Add `rebar-shop` to the `oauthIntegrations` array (so clicking Connect triggers the ConnectDialog flow instead of the field-entry setup dialog) — actually, better approach: add a status check for `rebar-shop` that calls the existing `wp-test` edge function.

- In `checkIntegrationStatus` (~line 265), add a handler for `rebar-shop`:
```typescript
if (integrationId === "rebar-shop") {
  const { data, error } = await supabase.functions.invoke("wp-test");
  if (error) throw new Error(error.message);
  const status = data?.ok ? "connected" : "error";
  // update state + toast
  return status;
}
```

- In `checkAllStatuses` (~line 455), add a rebar-shop check block that calls `wp-test` and updates the integration status.

- In `startOAuth` or equivalent, add a handler for `rebar-shop` that runs the same wp-test check (since clicking "Connect" when credentials already exist should just verify the connection).

**2. `src/hooks/useIntegrations.ts`** — Add `rebar-shop` to the list that gets the ConnectDialog treatment, OR better: since credentials are already stored, make the "Connect" button directly test the connection via `wp-test` edge function.

Add `"rebar-shop"` to the `oauthIntegrations` array so clicking it opens ConnectDialog, and add a handler in `startOAuth` for `rebar-shop` that invokes `wp-test` to verify the connection. If `ok: true`, set status to "connected" and save to `integration_connections` table.

