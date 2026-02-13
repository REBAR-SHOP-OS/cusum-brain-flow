

# Odoo-Style Header Rebuild for Rebar ERP

## Current ERP Header vs Odoo Header

### Odoo Header Structure (Backend/CRM)
The Odoo backend navbar is a single 46px-tall bar with a dark purple background (`#714B67` / `#7C3AED`-ish), structured as:

```text
[Grid Icon] [Module Name] [Breadcrumb > Trail] .............. [Search] [Messaging] [Bell] [Avatar]
|___ LEFT GROUP (app nav) ___|                                |_____ RIGHT GROUP (utilities) _____|
```

- **Grid icon**: 3x3 dot grid, opens app switcher (module list)
- **Module name**: Bold text of current module (e.g., "CRM", "Inventory")
- **Breadcrumb**: `>` separated path (e.g., "Pipeline" or "Pipeline > Lead Name")
- **Search bar**: Inline expandable input, not a modal trigger
- **Messaging**: Chat bubble icon with unread counter badge
- **Notifications**: Bell icon with counter badge
- **User avatar**: Circle with initials, dropdown with Preferences, My Profile, Log out

### Current ERP Header Issues (vs Odoo)
1. Brand logo + "REBAR OS" text takes up left side (Odoo uses grid icon + module name)
2. Warehouse selector clutters the header (not in Odoo)
3. Search opens a command palette modal (Odoo does inline search)
4. Wrench (admin console) icon visible in header (not Odoo-like)
5. Theme toggle in header (Odoo has no theme toggle in navbar)
6. User menu is a plain icon, not an avatar with initials
7. No breadcrumb system
8. No module name indicator

---

## Changes

### File: `src/components/layout/TopBar.tsx` (Major rewrite)

**Left group:**
1. Replace brand logo with a 3x3 grid icon (LayoutGrid from lucide) that toggles the sidebar visibility or navigates to `/home`
2. Add **active module name** derived from current route (e.g., "CRM" on `/pipeline`, "Inventory" on `/office`)
3. Add **breadcrumb** showing current page path using `useLocation()`

**Right group (strict order):**
1. Search input (inline style, not a button -- but keeps opening CommandBar on click since true inline search requires backend changes)
2. Notifications bell with badge (keep as-is)
3. User avatar with initials dropdown (rebuild UserMenu)

**Removed from header:**
- Brand logo and "REBAR OS" text (grid icon replaces it)
- Warehouse selector (move into user dropdown as a sub-option)
- Wrench/Admin Console button (move into user dropdown)
- Theme toggle (move into user dropdown under "Preferences")

**Visual changes:**
- Header height: 46px (Odoo standard)
- Background: Use `bg-primary` (purple-ish) with white text, matching Odoo's signature purple navbar. Falls back to theme-appropriate color.
- Icon size: 20px (Odoo standard)
- Font: 13px for module name (semibold), 12px for breadcrumb

### File: `src/components/layout/UserMenu.tsx` (Expand)

Rebuild to match Odoo's user dropdown:
- Show user avatar with initials at top
- User name/email display
- "Preferences" item (links to `/settings`, includes theme toggle sub-menu)
- "My Profile" item
- Warehouse selector (moved from header, admin/office only)
- Admin Console toggle (super admin only, moved from header)
- Separator
- "Log out" at bottom

### File: `src/components/layout/TopBar.tsx` -- Breadcrumb Logic

Add a route-to-module mapping:
```text
/home        -> Dashboard
/pipeline    -> CRM > Pipeline
/customers   -> CRM > Customers
/shop-floor  -> Manufacturing > Shop Floor
/deliveries  -> Logistics > Deliveries
/office      -> Office Portal
/admin/*     -> Administration
/settings    -> Settings
/inbox       -> Messaging > Inbox
/tasks       -> Messaging > Tasks
```

The breadcrumb renders as clickable segments separated by `>` chevrons.

---

## Mapping Table

| Odoo Element | Current ERP Element | New ERP Element |
|---|---|---|
| Grid app-switcher | Brand logo | LayoutGrid icon (click -> /home) |
| Module name | "REBAR OS" text | Dynamic module name from route |
| Breadcrumb | None | Route-based breadcrumb trail |
| Search bar | Command button (modal) | Styled as inline input, still opens CommandBar |
| Messaging icon | None | Not adding (no chat system exists) |
| Bell + badge | Bell button | Keep (same position, Odoo-matching style) |
| User avatar | User icon button | Avatar circle with initials |
| Theme toggle | Standalone header button | Inside user dropdown "Preferences" |
| Warehouse selector | Standalone header dropdown | Inside user dropdown |
| Admin console | Wrench button | Inside user dropdown |

## Interaction Parity

| Behavior | Odoo | ERP (New) |
|---|---|---|
| Click grid icon | Opens app switcher overlay | Navigates to /home (dashboard) |
| Click module name | Goes to module default view | Navigates to module root route |
| Click breadcrumb segment | Navigates to that level | Same |
| Click search area | Focuses inline search | Opens CommandBar (closest equivalent) |
| Click bell | Opens notification panel | Same (InboxPanel) |
| Click avatar | Opens user dropdown | Same (expanded UserMenu) |
| Keyboard Cmd+K | N/A in Odoo | Kept for power users (hidden) |

## Risk List

1. **Search behavior difference**: Odoo uses inline search with facets; ERP uses command palette. Keeping modal approach to avoid major refactor -- visually styled to look inline.
2. **No app switcher overlay**: Odoo's grid opens a full module grid. ERP uses sidebar navigation instead. Grid icon goes to /home as a reasonable substitute.
3. **Purple header in dark mode**: May clash with dark theme. Will use CSS variable approach so dark mode gets a slightly muted purple.
4. **Warehouse selector hidden**: Power users who relied on quick warehouse switching will need to open user menu. Acceptable tradeoff for header cleanliness.

## Technical Notes

- New hook or utility: `useActiveModule()` -- derives module name + breadcrumb from `useLocation().pathname`
- No new dependencies required
- All moved items (theme, warehouse, admin) remain accessible, just relocated to UserMenu dropdown
- Header height change from `h-12` (48px) to `h-[46px]` for exact Odoo match

