

# Plan: Add Team Hub Icon to Sidebar Below Inbox

## Change

### `src/components/layout/AppSidebar.tsx` (line 156)
Add a "Team Hub" nav item right after the "Inbox" entry in the Office group:

```typescript
{ name: "Inbox", href: "/inbox-manager", icon: Inbox, roles: ["admin", "office"], ... },
{ name: "Team Hub", href: "/team-hub", icon: MessageSquare, tourId: "nav-team-hub" },  // ← NEW
{ name: "Business Tasks", href: "/tasks", icon: CheckSquare, ... },
```

No role restriction — all authenticated internal users can access Team Hub. One line added, one file.

