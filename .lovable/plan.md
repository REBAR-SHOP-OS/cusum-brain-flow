

## Remove "Inbox" Feature from Application

### Summary
Remove the Inbox page, its navigation links, route definitions, and all references across the app. The `src/components/inbox/` folder and its 30+ component files will NOT be deleted since they may be used elsewhere (e.g., `InboxView` is rendered inside `Inbox.tsx` page, and `InboxPanel` is a notification panel used in Sidebar/TopBar which is separate from the Inbox page).

### Files to Modify

#### 1. `src/App.tsx`
- Remove `import Inbox from "./pages/Inbox"`
- Remove route: `<Route path="/inbox" ...>`
- Remove legacy redirect: `<Route path="/inbox-manager" ...>`
- Change redirect `<Route path="/emails/*" ...>` to point to `/home` instead of `/inbox`

#### 2. `src/components/layout/AppSidebar.tsx`
- Remove the `{ name: "Inbox", href: "/inbox", icon: Inbox, ... }` item from the nav items array
- Clean up unused `Inbox` icon import if no longer used

#### 3. `src/components/layout/Sidebar.tsx`
- Remove `{ name: "Inbox", href: "/inbox", icon: Inbox }` from `crmNav` array
- Change `navigate("/inbox", ...)` in `handleSelectSession` to `/home`
- Clean up unused `Inbox` icon import

#### 4. `src/components/layout/MobileNav.tsx`
- Remove `{ name: "Inbox", href: "/inbox", icon: Inbox }` from `primaryNav`

#### 5. `src/components/layout/MobileNavV2.tsx`
- Remove `{ name: "Inbox", href: "/inbox", icon: Inbox }` from `primaryNav`

#### 6. `src/components/layout/CommandBar.tsx`
- Remove `{ label: "Inbox", icon: Inbox, href: "/inbox", ... }` from `navCommands`

#### 7. `src/hooks/useActiveModule.ts`
- Remove `"/inbox"` entry
- Update `"/tasks"` moduleRoute from `"/inbox"` to `"/tasks"`

#### 8. `src/lib/notificationRouting.ts`
- Change `/emails` redirect destination from `"/inbox"` to `"/home"`
- Change `/inbox/[uuid]` redirect destination from `"/inbox"` to `"/home"`

#### 9. `src/pages/IntegrationCallback.tsx`
- Change Gmail callback redirect from `"/inbox"` to `"/home"`

#### 10. `src/components/auth/RoleGuard.tsx`
- Remove `"/inbox"` from all allowed-route arrays (3 occurrences)

#### 11. `src/components/integrations/AutomationsSection.tsx`
- Change route from `"/inbox"` to `"/home"` for the inbox automation entry

### Files NOT Modified (as per instructions)
- `src/components/inbox/*` -- 30 component files left untouched
- `src/pages/SupportInbox.tsx` -- completely separate feature, not related
- Database schema, edge functions, and all other features remain unchanged
- `src/pages/Inbox.tsx` will be deleted (the page file itself)

