

# Fix: `regenerate-post` Edge Function "non-2xx status code"

## Root Cause

The `regenerate-post` function is **missing from `supabase/config.toml`**. Without an explicit entry, the default `verify_jwt = true` kicks in. With Supabase's signing-keys system, this causes the **gateway itself** to reject the request before the function code ever runs — explaining:
- Zero logs in the function
- Generic "Edge Function returned a non-2xx status code" error

This is the same pattern applied to all other 30+ functions in the project (all set to `verify_jwt = false` with auth handled internally).

## Fix

### `supabase/config.toml`
Add the missing entry:
```toml
[functions.regenerate-post]
verify_jwt = false
```

### Deploy
Redeploy the `regenerate-post` edge function so the new config takes effect.

That's it — one line fix. The function code itself is correct and already handles auth internally via the service role client.

