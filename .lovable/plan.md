

# User Access Management from Vizzy Brain Panel

## Goal
Allow **sattar@rebar.shop** and **radin@rebar.shop** to add/remove agents and automations for any @rebar.shop user directly from the Vizzy Brain panel — replacing the need to edit hardcoded config files.

## Architecture

Currently, user access is hardcoded in `src/lib/userAccessConfig.ts`. We will add a **database-driven override layer** so super admins can manage access dynamically.

```text
┌─────────────────────────┐
│  userAccessConfig.ts    │  ← hardcoded defaults (fallback)
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│  user_access_overrides  │  ← DB table (takes priority when present)
│  email, agents[], automations[]
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│  Vizzy Brain Panel UI   │  ← edit buttons for super admins
└─────────────────────────┘
```

## Changes

### 1. Database: Create `user_access_overrides` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| email | text UNIQUE NOT NULL | user email |
| agents | text[] | agent keys (e.g. `{sales,accounting}`) |
| automations | text[] | automation ids (e.g. `{inbox-manager,daily-summarizer}`) |
| updated_by | text | email of admin who last modified |
| updated_at | timestamptz | default now() |
| company_id | uuid FK | tenant isolation |

RLS: SELECT/UPDATE/INSERT/DELETE restricted to users with `admin` role via `has_role()`.

### 2. Hook: `useUserAccessOverrides`

- Fetches override row for a given email from `user_access_overrides`
- Provides `saveAgents(email, agentKeys[])` and `saveAutomations(email, automationIds[])` mutations
- Invalidates query cache on save

### 3. Update `getVisibleAgents` / automation filtering

- Modify `getVisibleAgents()` to accept an optional override parameter
- In `VizzyBrainPanel`, when DB override exists for the selected user, pass those agent keys instead of the hardcoded ones
- Same pattern for automations in `UserAutomationsSection`

### 4. UI: Edit controls in Vizzy Brain Panel (super admins only)

**Agents section** — when viewer is sattar@ or radin@:
- Show a small **edit** (pencil) icon in the Agents header
- Clicking opens a dropdown/popover listing ALL available agents as checkboxes
- Checked agents = user has access; primary agent marked separately
- Save button persists to `user_access_overrides`
- Add/remove reflected immediately

**Automations section** — same pattern:
- Edit icon in Automations header
- Popover with all automation checkboxes
- Save persists to DB

**Visual indicators**:
- Small `×` badge on each agent/automation for quick removal
- `+` button at the end of the list to add new ones

### 5. Files to modify

| File | Action |
|------|--------|
| **Migration SQL** | Create `user_access_overrides` table + RLS policies |
| `src/hooks/useUserAccessOverrides.ts` | **Create** — fetch/save override data |
| `src/components/vizzy/VizzyBrainPanel.tsx` | **Edit** — add edit UI to Agents & Automations sections for super admins |
| `src/lib/userAccessConfig.ts` | **No change** — remains as fallback; override layer is applied at the component level |

### 6. Security
- Only sattar@ and radin@ see the edit controls (client-side gate)
- RLS on `user_access_overrides` enforces admin-only access server-side
- Non-admin users cannot modify the table even with direct API calls

