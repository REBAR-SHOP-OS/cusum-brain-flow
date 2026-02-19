
## Move Inbox and Business Tasks in Sidebar

Move "Inbox" and "Business Tasks" from the "System" group to the "Office" group, placed immediately after "Dashboard" (Home).

### Changes

**`src/components/layout/AppSidebar.tsx`**
- Remove "Inbox" and "Business Tasks" from the "System" group (lines 143-144)
- Insert them into the "Office" group right after the Dashboard entry (after line 110):
  - Inbox (with badge support)
  - Business Tasks
- The System group will retain only Settings and Admin Panel

**`src/components/layout/Sidebar.tsx`**
- Move "Business Tasks" from `operationsNav` to `crmNav`, positioned after the "Home" entry
- "Inbox" is already in `crmNav` so just reorder it to be right after Home
