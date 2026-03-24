

## Add "Groups" Section with "گروه رسمی شرکت" to Team Hub Sidebar

### What
Add a new "Groups" section in the sidebar (between Channels and Team Members) showing a group called **"گروه رسمی شرکت"**. All @rebar.shop users are members. Clicking it opens the same chat interface as channels.

### Changes

#### 1. Database: Create the group channel
```sql
INSERT INTO public.team_channels (name, description, channel_type)
VALUES ('گروه رسمی شرکت', 'گروه رسمی برای همه اعضای شرکت', 'group')
ON CONFLICT DO NOTHING;
```

#### 2. Sidebar: Add "Groups" section
**File**: `src/components/teamhub/ChannelSidebar.tsx`

- Add a new filter for the group:
  ```typescript
  const officialGroup = channels.filter(
    (c) => c.channel_type === "group" && c.name === "گروه رسمی شرکت"
  );
  ```
- Add a "Groups" section header (with `Users` icon) between Channels and Team Members
- Render `officialGroup` items with a `Users` icon instead of `Hash`
- Collapsible like Team Members

### Files Changed

| File | Change |
|---|---|
| Database migration | Insert "گروه رسمی شرکت" channel |
| `src/components/teamhub/ChannelSidebar.tsx` | Add "Groups" section showing the official group |

