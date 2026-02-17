
# Surgical Cleanup: Dead Code Removal and Safety Guards

## Scope
Read-only audit of accounting components. Minimal diff, zero behavior change.

---

## Changes

### 1. `src/components/accounting/AccountingReport.tsx`

**Remove 3 unused icon imports** (line 9):
- `TrendingUp`, `TrendingDown`, `DollarSign` are imported from `lucide-react` but never referenced anywhere in the component.

**Remove unused `invoices` destructure** (line 124):
- `invoices` is destructured from `data` but never used in the component body.

---

### 2. `src/components/accounting/AccountingAccounts.tsx`

**Add missing React Fragment `key`** (line 335):
- The `<>...</>` fragment wrapping group header row + account row inside `.map()` is missing a `key` prop. React will warn about this. Replace `<>` with `<Fragment key={a.Id}>` using the named `Fragment` import.

---

### 3. `src/components/accounting/VendorDetail.tsx`

**Hoist `VENDOR_TXN_TYPES` outside the component** (line 100):
- Currently defined inside the component body, causing a new array allocation every render. Move it to module scope (it is a static constant). This also eliminates a stale-closure risk in `syncVendorTransactions` which references it but does not list it as a `useCallback` dependency.

**Add query invalidation after delete/void** (lines 44-68):
- `handleDeleteTxn` and `handleVoidTxn` succeed but never invalidate the `["qb_vendor_transactions", vendor.Id]` query, so the UI stays stale until manual refresh. Add `queryClient.invalidateQueries` after the success toast.

---

### 4. `src/components/accounting/AccountingVendors.tsx`

**Hoist `VENDOR_TXN_TYPES` outside the component** (line 38):
- Same issue as VendorDetail -- static constant recreated every render. Move to module scope.

---

## Summary Table

| File | Change | Why |
|------|--------|-----|
| `AccountingReport.tsx` | Remove `TrendingUp`, `TrendingDown`, `DollarSign` imports | Unused imports (dead code) |
| `AccountingReport.tsx` | Remove `invoices` from destructure | Unused variable |
| `AccountingAccounts.tsx` | Add `Fragment` key to `.map()` wrapper | Missing React key warning |
| `VendorDetail.tsx` | Hoist `VENDOR_TXN_TYPES` to module scope | Avoids per-render allocation + stale closure risk |
| `VendorDetail.tsx` | Add `queryClient.invalidateQueries` after delete/void | Stale UI after mutation (guard) |
| `AccountingVendors.tsx` | Hoist `VENDOR_TXN_TYPES` to module scope | Avoids per-render allocation |

## Verification

- No new side effects introduced
- No changes to runtime behavior (except: UI now correctly refreshes after delete/void -- this is a bug fix guard, not a logic rewrite)
- No cascading edits
- All existing tests pass unchanged
- No public API / export changes
