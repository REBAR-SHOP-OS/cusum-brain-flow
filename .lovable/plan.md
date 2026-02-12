

## Polish Sprint v1.5 — Time Clock Fix + Dashboard Trust

### 1. Fix `list_time_entries` schema drift (the last broken endpoint)

**File: `supabase/functions/mcp-server/index.ts`** (line 223)

The SELECT currently includes `status` which doesn't exist on `time_clock_entries`. Real columns are: `id, profile_id, clock_in, clock_out, break_minutes, notes, created_at`.

Change:
```
.select("id, profile_id, clock_in, clock_out, status, created_at")
```
To:
```
.select("id, profile_id, clock_in, clock_out, break_minutes, notes, created_at")
```

Redeploy the edge function.

### 2. Deliveries — no fix needed

The `list_deliveries` tool SELECT already matches the real schema perfectly (`delivery_number, driver_name, vehicle, scheduled_date, status, notes`). The table has 0 rows, which is valid — no deliveries in progress.

### 3. Verify all endpoints after deploy

Call `list_time_entries` and `get_dashboard_stats` to confirm zero errors remain across all 9 MCP tools.

### Summary

- One line change in the MCP server
- Redeploy
- Verify
- All endpoints clean

