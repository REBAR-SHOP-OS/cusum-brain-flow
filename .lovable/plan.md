

## Fix: Customer name resolution in Production Queue

### Problem
Line 129 queries `v_customers_clean` selecting `customer_id, display_name` but casts the result as `{ id: string; name: string }`. Since Supabase returns the actual column names, `c.id` and `c.name` are `undefined`, causing all customer names to show as "Unknown Customer".

### Change

**`src/components/office/ProductionQueueView.tsx`** — Line 129: Change the select to use the correct column names that match the expected type:

```typescript
// BEFORE
const { data, error } = await supabase.from("v_customers_clean" as any).select("customer_id, display_name").in("customer_id", projectCustomerIds);
return ((data || []) as unknown) as Array<{ id: string; name: string }>;

// AFTER
const { data, error } = await supabase.from("v_customers_clean" as any).select("id, name").in("customer_id", projectCustomerIds);
return ((data || []) as unknown) as Array<{ id: string; name: string }>;
```

Wait — the `in` filter uses `customer_id` which is the same as `id` in this view. Let me check if `id` equals `customer_id`.

Actually, looking at the view columns, `id` and `customer_id` are separate columns. The `in` filter on `customer_id` is correct (projects store `customer_id`). But we need the `id` field (which is likely the same as `customer_id` in this view, since it's a clean/deduplicated view).

The simplest fix: select columns aliased to match:

```typescript
const { data, error } = await supabase.from("v_customers_clean" as any)
  .select("id:customer_id, name:display_name")
  .in("customer_id", projectCustomerIds);
return ((data || []) as unknown) as Array<{ id: string; name: string }>;
```

This aliases `customer_id` → `id` and `display_name` → `name`, matching the expected type.

### Verification
After this fix:
- "Valard Construction LP" should display correctly instead of "Unknown Customer"
- The Type 6 Chamber manifest count (2 manifests: 1 linked + 1 loose) should display correctly (this part was already working, only names were broken)

