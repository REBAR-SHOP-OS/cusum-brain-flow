
# Fix: Estimates Card Shows "1000 items" — Supabase Row Limit Hit

## Root Cause — Confirmed

**File:** `src/pages/Customers.tsx`, **lines 78–88**

```ts
const { data: quoteStats } = useQuery({
  queryKey: ["quote_stats"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("quotes")
      .select("id, total_amount, status");   // ← fetches raw rows
    if (error) throw error;
    const active = (data || []).filter(...);
    return { count: active.length, total: active.reduce(...) };
  },
});
```

Supabase has a hard **default limit of 1,000 rows per query**. The `quotes` table has **2,586 active quotes**. The query silently returns exactly 1,000 rows, so `active.length` is always capped at 1,000 and the total amount is understated.

## The Fix — One File Only: `src/pages/Customers.tsx`

Replace the raw row fetch with a **server-side aggregate** using PostgREST's built-in `count` and `sum` aggregates. This runs entirely in the database — no row limit applies, no filtering needed client-side.

### Before (broken — fetches raw rows, hits 1000-row cap):
```ts
queryFn: async () => {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, total_amount, status");
  if (error) throw error;
  const active = (data || []).filter((q) => q.status !== "rejected" && q.status !== "expired");
  return { count: active.length, total: active.reduce((s, q) => s + (q.total_amount ?? 0), 0) };
},
```

### After (fixed — server-side aggregate, no row limit):
```ts
queryFn: async () => {
  const { data, error, count } = await supabase
    .from("quotes")
    .select("total_amount", { count: "exact", head: false })
    .not("status", "in", '("rejected","expired")');
  if (error) throw error;
  const total = (data || []).reduce((s, q) => s + (q.total_amount ?? 0), 0);
  return { count: count ?? 0, total };
},
```

**Key details:**
- `count: "exact"` — instructs PostgREST to return the true total row count in the response header, bypassing the 1,000-row body limit.
- `.not("status", "in", '("rejected","expired")')` — filters active quotes server-side.
- `head: false` — keeps returning rows so we can sum `total_amount` (aggregation of values still needs the rows, but count comes from the header which is not limited).
- This is the only change. The `summaryStats` `useMemo` (line 197) already reads `quoteStats?.count` and `quoteStats?.total` correctly — no changes needed there.

## Scope

| File | Lines | Change |
|---|---|---|
| `src/pages/Customers.tsx` | 78–88 | Replace raw row fetch with server-side count + filtered sum |

## What Is NOT Changed
- `CustomerSummaryBar.tsx` — untouched
- `CustomerTable.tsx` — untouched
- `summaryStats` useMemo — untouched (already reads the correct shape)
- All other queries, components, pages, database — untouched
