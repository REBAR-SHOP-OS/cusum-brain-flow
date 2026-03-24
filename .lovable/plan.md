

## Fix Sales Lead Drawer: Mentions, Assignee Permissions, Delete Restriction

### Problems
1. **"@" mention not working** in `SalesLeadChatter` — the chatter has no `MentionMenu` integration (unlike OdooChatter, LeadTimeline, etc.)
2. **External estimators can add/remove assignees** — the `AssigneeManager` in the drawer has no `readOnly` guard for external users
3. **External estimators can delete leads** — the Delete button in the drawer footer is visible to everyone

### Changes

| File | Change |
|---|---|
| `src/components/sales/SalesLeadChatter.tsx` | Add `MentionMenu` with `@` detection on the note textarea (same pattern as OdooChatter) |
| `src/components/sales/SalesLeadDrawer.tsx` | Accept `isExternalEstimator` prop; pass `readOnly={true}` to `AssigneeManager` for external users; hide Delete button, priority selector, and stage buttons for external users |
| `src/pages/sales/SalesPipeline.tsx` | Pass `isExternalEstimator` to `SalesLeadDrawer` |

### Detail

**SalesLeadChatter.tsx** — Add mention support:
- Import `MentionMenu` from `@/components/chat/MentionMenu`
- Add `mentionOpen`, `mentionFilter`, `mentionIndex` state
- On `setText`, detect `@word$` pattern to open the menu
- On mention select, replace `@word` with `@Name `
- Handle ArrowUp/Down/Escape keys for navigation
- Render `<MentionMenu>` inside the composer block

**SalesLeadDrawer.tsx** — Restrict external estimator actions:
- New prop: `isExternalEstimator?: boolean`
- When true: `AssigneeManager` gets `readOnly={true}`
- When true: hide the Delete `AlertDialog` in footer
- When true: hide the priority `Select` and disable stage ribbon buttons

**SalesPipeline.tsx** — Pass the flag:
- Pass `isExternalEstimator={isExternalEstimator}` to `SalesLeadDrawer`

