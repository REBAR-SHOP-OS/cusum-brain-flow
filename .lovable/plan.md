

## Plan: Recover Deleted Projects from Production Queue

### What happened
The Production Queue delete buttons perform **hard deletes** — they removed projects, barlists, and cut_plans from the database. However, the underlying **extract sessions and extract rows are still intact** because their delete was either skipped or failed silently.

### Recoverable data (still in database)

| Session | Name | File | Rows | Unit | Status |
|---------|------|------|------|------|--------|
| `97c40520` | ET11109 MAZDA | ET11109 MAZDA BAR LIST.xlsx | 2 | mm | approved |
| `cb20d0df` | ET11109 MAZDA | ET11109 MAZDA BAR LIST.xlsx | 2 | ft | approved |
| `6568dcdd` | Pink Wall | PINK WALL TAGS.xlsx | 9 | in | mapped |
| `f84c0267` | Pink wall | PINK WALL TAGS.xlsx | 9 | in | mapped |
| `4b7a00cf` | ET11109 MAZDA | Cages.xlsx | 2 | imperial | mapped |
| `71332bf1` | ET11109 MAZDA | Cages.xlsx | 2 | mm | mapped |
| `ad9c3217` | ET11109 MAZDA | Cages.xlsx | 2 | in | mapped |
| `37607cb3` | ET11109 MAZDA | Cages.xlsx | 2 | imperial | mapped |

The "EPOXY TIES" project + barlist still exists and was **not** deleted.

### Recovery steps

1. **Re-create projects** — INSERT into `projects` table for each unique project name that was deleted (ET11109 MAZDA, Pink Wall, etc.) using `company_id = a0000000-0000-0000-0000-000000000001`

2. **Re-create barlists** — INSERT into `barlists` table, linking each to its project and extract_session_id

3. **Re-link extract sessions** — The sessions already exist with all their row data; they just need a barlist parent again

4. **Cut plans** — These were also deleted. They can be recreated from the Detailed List view by the user when needed (no raw data to recover for these).

### Questions before proceeding

Before I restore, I need to confirm which sessions you actually want recovered — some appear to be duplicates (multiple "ET11109 MAZDA" sessions with different units, and two "Pink Wall" sessions). Should I restore all of them, or only specific ones?

### Technical detail
- Recovery is done via database migration (INSERT statements)
- No code changes needed — the Production Queue UI will automatically show restored items
- Extract rows, raw files, and all extraction data are fully intact

