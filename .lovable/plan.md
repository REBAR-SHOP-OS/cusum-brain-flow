

# App Builder → Full IDE Workspace (Lovable-style)

## What You Want
Transform the current plan-only App Builder into a full development workspace like Lovable — with a settings menu, project history, knowledge management, file attachments, screenshot capture, connectors panel, visual edits mode, and deep integration with all existing modules (rebar.shop, ERP, Odoo, the Architect agent).

## Architecture

Merge the best of both worlds: the **structured planning UI** (current App Builder) + the **AI chat + file/diagnostic capabilities** (current EmpireBuilder at `/empire`) into one unified workspace.

```text
/app-builder                    → Landing + Dashboard (keep existing)
/app-builder/:projectId         → Full IDE Workspace (upgraded)
```

## Changes

### 1. Upgrade Sidebar with Lovable-style sections
**File**: `AppBuilderSidebar.tsx`

Add new nav sections:
- **Connectors** — links to rebar.shop, ERP, Odoo (the project cards from EmpireBuilder)
- **Knowledge** — show/manage project memories (reuse the memory fetch from EmpireBuilder)
- **History** — version history + chat history combined
- Divider between planning sections and management sections

### 2. Add Settings dropdown/panel
**File**: New `AppBuilderSettingsMenu.tsx`

A dropdown menu (like Lovable's) triggered from project name in sidebar header:
- **Project Settings** — name, description, status
- **History** — link to versions section
- **Knowledge** — open knowledge panel
- **Connectors** — show connected modules (rebar.shop, ERP, Odoo)
- **Take a Screenshot** — capture preview panel
- **Add Reference** — open file picker
- **Attach** — file upload

### 3. Upgrade Prompt Bar to Lovable-style input
**File**: `AppBuilderPromptBar.tsx`

Replace the simple textarea with a full chat composer:
- **+ button** (left) — dropdown: Attach file, Take screenshot, Add reference, Use template
- **Chat/Plan mode toggle** — switch between "Build mode" (AI modifies plan) and "Chat mode" (discuss without changes)
- **File attachment chips** — show pending files with preview thumbnails and remove buttons
- **Drag-and-drop** file support (reuse the logic from EmpireBuilder)
- **Send button** (right) — orange gradient, circular

### 4. Add AI Chat panel alongside planning
**File**: `AppBuilderWorkspace.tsx`

Add a new sidebar section **"Chat"** that shows the Architect agent conversation within the workspace context. When in chat mode:
- Messages stream in the center panel
- The right panel still shows preview
- Chat has full context of the current project plan

Wire `sendAgentMessage` from `src/lib/agent.ts` with the empire agent config so the AI can diagnose rebar.shop, check ERP, and modify the plan.

### 5. Connectors panel
**File**: New `AppBuilderConnectors.tsx`

Display connected modules as cards (same style as EmpireBuilder's project buttons):
- **rebar.shop** — status indicator, click to diagnose
- **ERP** — status indicator, click to check
- **Odoo** — status indicator, click to sync
- **+ Add Connector** button

Clicking a connector sends a diagnostic prompt to the AI chat.

### 6. Knowledge panel
**File**: New `AppBuilderKnowledge.tsx`

Fetch and display project memories from the `agent_memory` table (reuse `useCompanyId` + memory query from EmpireBuilder). Allow:
- View memories by category
- Delete memories
- Add manual knowledge entries

### 7. Update hook with new sections + chat state
**File**: `useAppBuilderProject.ts`

- Add new `SidebarSection` values: `"chat"`, `"connectors"`, `"knowledge"`
- Add chat message state (`messages`, `isLoading`, `sendMessage`)
- Add file attachment state (`pendingFiles`, `addFiles`, `removeFile`)
- Add mode toggle (`buildMode` vs `chatMode`)

### 8. Wire rebar.shop diagnostics
The Architect agent already has WordPress diagnostic capabilities. The chat integration in step 4 gives direct access — users can type "fix rebar.shop header" and the AI will use the existing `empire` agent tools.

## Files

| File | Action |
|------|--------|
| `src/components/app-builder/AppBuilderSidebar.tsx` | Add connectors, knowledge, chat, dividers |
| `src/components/app-builder/AppBuilderPromptBar.tsx` | Rewrite as Lovable-style composer with +menu, attachments, mode toggle |
| `src/components/app-builder/AppBuilderWorkspace.tsx` | Add chat view, connectors view, knowledge view, settings menu |
| `src/components/app-builder/AppBuilderSettingsMenu.tsx` | New — dropdown menu from project name |
| `src/components/app-builder/AppBuilderConnectors.tsx` | New — connected modules panel |
| `src/components/app-builder/AppBuilderKnowledge.tsx` | New — memory/knowledge management |
| `src/components/app-builder/AppBuilderChat.tsx` | New — AI chat panel reusing agent infrastructure |
| `src/hooks/useAppBuilderProject.ts` | Add chat state, file state, mode toggle, new sections |
| `src/data/appBuilderMockData.ts` | Add connector definitions |

No database changes. No edge function changes. Reuses existing `sendAgentMessage`, `agent_memory`, and empire agent config.

