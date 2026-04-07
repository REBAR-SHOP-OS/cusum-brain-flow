

# Per-User Menu Access + General Report Filtering

## Two Changes

### 1. Update `src/lib/userAccessConfig.ts` — Menu Items per User

Currently `sattar@rebar.shop` has `fullAccess: true`. The user now wants explicit items listed. Update:

**sattar@rebar.shop**: Remove `fullAccess: true`, set explicit menus:
```
Dashboard, Inbox, Team Hub, Business Tasks, Live Monitor, CEO Portal, Support,
Pipeline, Lead Scoring, Customers, Accounting, Sales, Shop Floor, Time Clock,
Office Tools, Inventory, Diagnostics, Architecture, Settings, Admin Panel
```
(This is effectively all items, but explicitly listed per the user's request.)

**radin@rebar.shop**: Keep `fullAccess: true` (user said "all items").

All other users are already correct in `userAccessConfig.ts` — verified against the user's list.

### 2. Filter General Report Sections by User's Menu Access

**File: `src/components/vizzy/VizzyBrainPanel.tsx`**

Add a mapping from SIDEBAR_GROUPS keys to menu names, then filter `sectionsToShow` based on the current user's `getVisibleMenus()`.

**Mapping** (SIDEBAR_GROUP key → MenuKey):
| Group Key | Menu Name |
|-----------|-----------|
| dashboard | Dashboard |
| inbox | Inbox |
| team_hub | Team Hub |
| tasks | Business Tasks |
| monitor | Live Monitor |
| ceo | CEO Portal |
| support | Support |
| pipeline | Pipeline |
| lead_scoring | Lead Scoring |
| customers | Customers |
| accounting | Accounting |
| sales | Sales |
| production | Shop Floor |
| shop_floor | Shop Floor |
| timeclock | Time Clock |
| office_tools | Office Tools |

**Implementation**:
1. Import `getVisibleMenus` from `@/lib/userAccessConfig`
2. Get current user email from `useAuth()`
3. Compute `visibleMenus = getVisibleMenus(email)`
4. Create a `GROUP_TO_MENU` constant mapping each group key to its required menu name
5. In the `sectionsToShow` computation (~line 907), filter groups to only include those whose mapped menu is in the user's visible menus
6. Super admins (fullAccess) see all sections — no filtering needed since `getVisibleMenus` already returns all menus for them

This ensures Zahra only sees "Business Tasks" and "Support" sections in General Report, Kourosh only sees "Time Clock", "Shop Floor", and "Team Hub", etc.

## Files Changed
| File | Change |
|------|--------|
| `src/lib/userAccessConfig.ts` | Update sattar's config to explicit menu list (remove fullAccess) |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Filter General Report sections by user's menu access |

