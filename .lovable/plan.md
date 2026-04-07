

# Refactor: Centralized User Access, Menu Visibility & Agent Assignment

## Summary
Create a single source-of-truth configuration file that defines per-user menu access and agent access by email. Replace all scattered hardcoded checks across sidebar, Home page helpers, VizzyBrainPanel agent sections, RoleGuard, and userAgentMap with lookups to this config.

## New File: `src/lib/userAccessConfig.ts`

Central config object with:
- `ALL_MENUS`: canonical list of menu keys matching sidebar items
- `ALL_AGENTS`: canonical list of agent keys matching `agentConfigs`
- Per-user entries keyed by email, each with:
  - `fullAccess?: boolean` (for sattar, radin — skips listing everything)
  - `menus: string[]` (menu keys user can see)
  - `agents: string[]` (agent keys user can access)
  - `primaryAgent?: string` (default agent key)
  - `heroText?: string` (for Home page)
  - `quickActions?: [...]` (for Home page)
- Helper functions: `getVisibleMenus(email)`, `getVisibleAgents(email)`, `getUserPrimaryAgentKey(email)`, `hasMenuAccess(email, menuKey)`, `hasAgentAccess(email, agentKey)`

### Exact user definitions:

| User | fullAccess | Menus | Agents | Primary |
|------|-----------|-------|--------|---------|
| sattar@ | ✅ | all | all | assistant |
| radin@ | ✅ | all | all | assistant |
| zahra@ | — | Business Tasks, Support | pixel, eisenhower, support | social |
| neel@ | — | all except CEO Portal | all except assistant | sales |
| vicky@ | — | Dashboard, Team Hub, Business Tasks, Customers, Accounting, Architecture, Settings | talent, bizdev, eisenhower, accounting, rebuild | accounting |
| ben@ | — | Sales, Support, Business Tasks | sales, support, eisenhower | sales |
| saurabh@ | — | Dashboard, Inbox, Team Hub, Business Tasks, Live Monitor, Support, Pipeline, Lead Scoring, Customers, Sales, Shop Floor, Time Clock, Office Tools, Inventory, Architecture, Settings | sales, shopfloor, email, support, bizdev, eisenhower, talent, webbuilder, copywriting, seo, growth, purchasing, estimating | sales |
| kourosh@ | — | Time Clock, Shop Floor, Team Hub | (none) | — |
| ai@ | — | Kiosk, Shop Floor, Team Hub | shopfloor, talent | shopfloor |
| swapnil@ | — | Time Clock, Team Hub | talent | — |
| tariq@ | — | Time Clock, Team Hub | talent | — |

## Files Changed

### 1. `src/lib/userAccessConfig.ts` (NEW)
Single source of truth. Contains all user→menu and user→agent mappings, plus helper functions. Replaces scattered logic in `userAgentMap.ts`, `accessPolicies.ts` (partially), and inline sidebar checks.

### 2. `src/components/layout/AppSidebar.tsx`
- Import `getVisibleMenus` from new config
- Map each nav item to a canonical menu key
- In internal-user rendering: filter `navGroups` items using `getVisibleMenus(email)` instead of role-based `hasAccess`
- Keep existing `ai@rebar.shop` and external-employee early returns but update them to use the config
- Remove role-based `hasAccess` logic for internal users (replaced by email-based config lookup)

### 3. `src/pages/Home.tsx`
- Import `getVisibleAgents` from new config
- Replace the `orderedHelpers` filtering logic (lines 125-138) with: filter `helpers` array to only include agents in `getVisibleAgents(email)`
- Keep primary-agent-first ordering
- If user has zero visible agents, hide the helpers grid entirely

### 4. `src/lib/userAgentMap.ts`
- Rewrite to import from `userAccessConfig.ts` for primary agent and hero text
- Keep `getUserAgentMapping`, `getUserPrimaryAgent`, `getUserPrimaryAgentKey` signatures but delegate to the new config
- Remove the hardcoded `userAgentMappings` object

### 5. `src/components/vizzy/VizzyBrainPanel.tsx` (UserAgentsSections)
- Replace `roleAgentAccess` mapping (lines 194-201) with `getVisibleAgents(email)`
- Remove `userRole`-based lookup; use email-based config directly

### 6. `src/components/layout/LiveChatWidget.tsx`
- Add check: if `getVisibleAgents(email).length === 0`, return null (same as ai@ check, but generalized)

### 7. `src/components/auth/RoleGuard.tsx`
- Import `hasMenuAccess` from new config
- For internal users after roles load: check if current route's menu key is in user's allowed menus
- Keep existing external-user logic and super-admin bypass intact

### 8. Cleanup
- Remove `Chase`, `commander`, `Cal`, `collections` references from any UI code if found
- `agentConfigs.ts`: no changes needed (registry is already correct per the user's list)
- `AgentSelector.tsx`: this is a legacy component used in old chat UI; leave as-is since it's not the primary agent display

## Safety
- Super admins (sattar, radin) still bypass via `fullAccess: true`
- Kourosh: zero agents, no agent widgets shown
- Zahra: strictly limited to Business Tasks + Support menus, Pixel + Eisenhower + Haven agents
- Ben: no Accounting menu, no Penny agent
- CEO Portal: only sattar and radin (via fullAccess)
- ai@rebar.shop: Kiosk + Shop Floor + Team Hub menus; Forge + Scouty agents only

## Retired/Renamed
- `Chase` / `collections` → merged into Penny (already done in agentConfigs; remove any lingering UI references)
- `commander` → removed (no references in agentConfigs; clean up any backend references)
- `estimation` → already `estimating` / Gauge in agentConfigs
- `Cal` → not present in current agentConfigs; no action needed

