

# Grant CEO Portal Access to radin@rebar.shop

## Change

**`src/hooks/useSuperAdmin.ts`** (line 3):

Add `radin@rebar.shop` to the `SUPER_ADMIN_EMAILS` array:

```typescript
// Before
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop"];

// After
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop"];
```

This single change grants radin access to CEO Portal and all other super-admin-gated features (Vizzy, LiveChat, etc.).

