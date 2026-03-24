

## Show All @rebar.shop Users in Team Members

### Problem

The sidebar filters `profiles.filter(p => p.is_active !== false)` — but **9 out of 13 profiles** have `is_active = false` in the database, including Sattar, Neel, Vicky, Zahra, Kourosh, and Ben. That's why only 4 members appear.

| Profile | is_active | Visible? |
|---|---|---|
| Ai | true | Yes |
| Radin Lachini | true | Yes |
| Saurabh Seghal | true | Yes |
| Tariq Amiri | true | Yes |
| Sattar Esmaeili | **false** | No ❌ |
| Neel Mahajan | **false** | No ❌ |
| Zahra Zokaei | **false** | No ❌ |
| Behnam Rajabifar | **false** | No ❌ |
| Kourosh Zand | **false** | No ❌ |
| Vicky Anderson | **false** | No ❌ |

### Fix

**File**: `src/components/teamhub/ChannelSidebar.tsx`

Remove the `is_active` filter on line ~56. Show ALL profiles in the Team Members list. Optionally dim inactive members slightly so there's a visual distinction, but don't hide them.

```
BEFORE: const activeProfiles = profiles.filter((p) => p.is_active !== false);
AFTER:  const activeProfiles = profiles; // Show all team members
```

Also filter out non-rebar.shop emails (like `deleted_*@removed.invalid` and `General Labour` with no email) to keep the list clean:

```typescript
const activeProfiles = profiles.filter((p) => 
  p.email?.endsWith("@rebar.shop") || p.email?.endsWith("@gmail.com")
);
```

Update the badge count to reflect the filtered list length.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Remove `is_active` filter, show all @rebar.shop + @gmail.com profiles |

