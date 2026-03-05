

# Fix Cutter-01 and Cutter-02 Machine Capabilities

## Problem
Both cutters have identical capabilities (10M–35M) in the `machine_capabilities` table. The code filter we just added works correctly, but the DB data doesn't match the routing rules:
- **Cutter-01** should only handle **10M, 15M** (below 20M)
- **Cutter-02** should only handle **20M, 25M, 30M, 35M**

## Fix
Run a database migration to remove incorrect capabilities:
1. Remove 20M, 25M, 30M, 35M from Cutter-01 (`e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3`)
2. Remove 10M, 15M from Cutter-02 (`b0000000-0000-0000-0000-000000000002`)

No code changes needed — the filter from the previous edit will handle the rest.

