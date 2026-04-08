

# Show User Role & Job Title in Vizzy Brain Panel

## Summary
Display each user's **role** (admin, sales, etc.) and **job title** from their profile in the user tab bar, so admins can quickly see who does what.

## Changes

### 1. Fetch user roles (`src/components/vizzy/VizzyBrainPanel.tsx`)

Add a query to fetch roles from `user_roles` table, mapped by `user_id`:

```typescript
const { data: userRoles } = useQuery({
  queryKey: ["vizzy_brain_user_roles"],
  queryFn: async () => {
    const userIds = profiles.filter(p => p.user_id).map(p => p.user_id);
    const { data } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
    return data || [];
  },
  enabled: profiles.length > 0,
});
```

Build a `roleMap: Record<string, string>` from `user_id → role`.

### 2. Update user tab buttons (lines 1046–1062)

Change each user button from showing only the first name to a **two-line layout**:
- Line 1: **First name** (bold)
- Line 2: **Role badge** + **job title** (small, muted)

```text
Before:  [🔵 R]  Radin
After:   [🔵 R]  Radin
                  Admin · CEO
```

The role is shown as a small colored badge (e.g., "Admin" in primary, "Sales" in blue, etc.) and the title comes from `p.title` (already in the profile data).

### 3. Layout adjustment

Change buttons from single-line `items-center` to allow wrapping of the subtitle. Keep the compact `px-3 py-2` sizing but allow a second line for role/title info using a `flex-col` wrapper for the text portion.

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Fetch user roles, display role badge + job title under each user's name |

