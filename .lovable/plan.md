

# App Builder: Remove Sidebar, Add Projects and Memory

## Overview

Remove the duplicate 72px icon sidebar from the `/empire` page, and replace the hero welcome screen with a useful left-side panel showing **Projects** (rebar.shop, ERP, ODOO + add new) and **Memory** (from `vizzy_memory` table), while keeping the chat input and conversation flow.

## Layout After Changes

```text
+--------------------------------------------------+
|  Cyan Topbar (Dashboard + Search + Avatar)        |
+--------------------------------------------------+
|                                                    |
|  [Projects Section]                                |
|  +-----------+ +-----------+ +-----------+ [+Add] |
|  | rebar.shop| |   ERP     | |   ODOO    |        |
|  +-----------+ +-----------+ +-----------+         |
|                                                    |
|  [Memory Section]                                  |
|  Recent memories from vizzy_memory...              |
|                                                    |
|  "Build something great"                           |
|  [Input Box]                                       |
|  [Suggestion pills]                                |
|                                                    |
+--------------------------------------------------+
```

When a conversation starts, the projects/memory sections scroll away above the chat messages.

## Changes

### 1. Delete EmpireSidebar

**File: `src/components/empire/EmpireSidebar.tsx`** -- Delete this file entirely.

**File: `src/pages/EmpireBuilder.tsx`** -- Remove the `EmpireSidebar` import and its usage from the JSX. The layout becomes just `<main>` filling the full width (no sidebar wrapper needed).

### 2. Add Projects Section to Hero Screen

**File: `src/pages/EmpireBuilder.tsx`** -- Add a projects grid above the hero heading in the welcome (no-conversation) view:

- Three hardcoded project cards: **rebar.shop** (Globe icon), **ERP** (Boxes icon), **ODOO** (Activity icon)
- Each card is a dark glass pill (`bg-white/5 border border-white/10 rounded-xl`) showing the project name and a status dot
- A "+ Add Project" button at the end that shows a simple dialog or toast placeholder for future expansion
- Cards are clickable and will pre-fill the chat input with a project-scoped prompt (e.g., "Check status of rebar.shop")

### 3. Add Memory Section

**File: `src/pages/EmpireBuilder.tsx`** -- Add a memory section between the projects and the hero heading:

- Query `vizzy_memory` table for recent entries (limit 5)
- Display as compact pills/chips showing the memory category and a truncated content preview
- Show a memory count badge (like LiveChat already does with the Brain icon)
- If no memories exist, show a subtle "No memories yet" text
- Uses the existing `supabase` client -- no new hooks needed, just a simple `useEffect` + `useState`

### 4. Update Layout Structure

**File: `src/pages/EmpireBuilder.tsx`**:

Current structure:
```
div (min-h-screen flex)
  EmpireSidebar      <-- REMOVE
  main (flex-1)
    EmpireTopbar
    section (hero or chat)
```

New structure:
```
div (min-h-screen flex flex-col)
  EmpireTopbar
  main (flex-1, overflow-y-auto)
    section (hero with projects + memory + input)
    -- or --
    section (chat messages + bottom input)
```

## Technical Details

### Projects Data
Hardcoded array (not from the `projects` table, which stores rebar construction projects):
```typescript
const EMPIRE_PROJECTS = [
  { name: "rebar.shop", icon: Globe, color: "from-cyan-400 to-blue-500", status: "active" },
  { name: "ERP", icon: Boxes, color: "from-purple-400 to-indigo-500", status: "active" },
  { name: "ODOO", icon: Activity, color: "from-orange-400 to-red-500", status: "active" },
];
```

### Memory Query
```typescript
const [memories, setMemories] = useState([]);
useEffect(() => {
  supabase
    .from("vizzy_memory")
    .select("id, category, content, created_at")
    .order("created_at", { ascending: false })
    .limit(5)
    .then(({ data }) => { if (data) setMemories(data); });
}, []);
```

### Project Card Click Behavior
Clicking a project card pre-fills the chat with a context-aware prompt:
- "rebar.shop" -> sends "Run a diagnostic on rebar.shop"
- "ERP" -> sends "Check ERP system status"
- "ODOO" -> sends "Check Odoo CRM sync status"

### Add Project Button
Opens a simple dialog (using existing Dialog component) with a text input for the project name. For now, it can add to local state only; database persistence can be added later.

## Files Summary

| File | Action |
|---|---|
| `src/components/empire/EmpireSidebar.tsx` | Delete |
| `src/pages/EmpireBuilder.tsx` | Modify: remove sidebar, add projects grid, add memory section, restructure layout |

