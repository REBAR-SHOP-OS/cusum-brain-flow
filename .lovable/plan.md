

# Add Task Management Tools to Vizzy

## What Changes

**1 file changed:** `supabase/functions/admin-chat/index.ts`

### New Tool Definitions (added to `JARVIS_TOOLS` array, after `web_research`)

| Tool | Type | Parameters |
|------|------|------------|
| `list_tasks` | Read | `assigned_to_name?`, `status?` (open/in_progress/completed/cancelled), `priority?` (low/medium/high/urgent), `date?` (YYYY-MM-DD, filters due_date), `limit?` (default 30) |
| `create_task` | Write (confirmation) | `title` (required), `description?`, `priority?`, `due_date?`, `assigned_to_name?`, `customer_name?` |
| `update_task_status` | Write (confirmation) | `task_id` (required), `status?`, `priority?`, `resolution_note?` |

### Handler Logic

**`list_tasks`** (in `executeReadTool`, ~30 lines):
- If `assigned_to_name` provided: query `profiles` with `ilike` on `full_name` to get profile IDs, then filter `tasks.assigned_to` by those IDs
- Query `tasks` with optional filters for status, priority, due_date
- Scope by `company_id` (from the function's companyId)
- Second query to resolve `customer_id` → customer name via `customers` table
- Returns: id, title, status, priority, due_date, assigned_to (profile name), customer name, source, agent_type, created_at, description

**`create_task`** (in `executeWriteTool`, ~25 lines):
- Resolve `assigned_to_name` → `profiles.id` via `ilike` on `full_name`
- Resolve `customer_name` → `customers.id` via `ilike` on `name` or `company_name`
- Insert into `tasks` with: company_id, source="vizzy", created_by_profile_id (CEO's profile), assigned_to, customer_id, title, description, priority, due_date
- Uses service client (bypasses RLS since admin action)

**`update_task_status`** (in `executeWriteTool`, ~15 lines):
- Build update object from provided fields (status, priority, resolution_note)
- If status="completed", set `completed_at = now()`
- Update by task_id, scoped to company_id

### WRITE_TOOLS Set Update
Add `"create_task"` and `"update_task_status"` to the `WRITE_TOOLS` set (line 11).

### Progress Labels Update
Add to `progressLabels` (line ~2611):
- `list_tasks: "tasks"`

### `buildActionDescription` Update
Add cases for `create_task` and `update_task_status`.

### Self-Awareness Update (`vizzyIdentity.ts`)
Add to "You CAN" list (line ~262):
- `Query, create, and update tasks — answer "what are Neel's tasks?" or "create a task for Neel"`

Add to TOOL USAGE RULES (line ~249):
- Add `list_tasks` to read tools list
- Add `create_task`, `update_task_status` to write tools list

## Impact
- 2 files changed (`admin-chat/index.ts`, `vizzyIdentity.ts`)
- Vizzy can query any team member's tasks, create new tasks, and update task status
- All write operations require CEO approval via confirmation UI
- No database or UI changes needed

