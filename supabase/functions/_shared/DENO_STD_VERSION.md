# Deno Standard Library Version Convention

**Approved version: `0.190.0`**

All edge functions in this project MUST use `https://deno.land/std@0.190.0/` for any Deno standard library imports.

## Why
- Version `0.168.0` causes 500 Internal Server Error on deploy due to incompatible bundling.
- Mixing versions causes lockfile conflicts and deploy failures.

## Quick audit command
```bash
grep -rn "deno.land/std@" supabase/functions/ --include="*.ts" | grep -v "0.190.0" | grep -v "DENO_STD_VERSION"
```

If the above returns any results, those files need updating to `0.190.0`.
