

## Show Only One Channel: "کانال رسمی شرکت"

### Problem
The sidebar currently shows all 4 group channels (General, rsic, management-communication, management). The user wants only ONE channel visible: **کانال رسمی شرکت** (Official Company Channel).

### Approach

Two things need to happen:

1. **Rename an existing channel** in the database to "کانال رسمی شرکت" (e.g. rename "General")
2. **Filter the sidebar** to show only that one channel

Since we can't know which channel ID to keep without risking data loss, the cleanest approach:

### Changes

**File: `src/components/teamhub/ChannelSidebar.tsx`**

1. Filter `groupChannels` to only show the channel named "کانال رسمی شرکت":
   ```typescript
   const groupChannels = channels.filter(
     (c) => c.channel_type === "group" && c.name === "کانال رسمی شرکت"
   );
   ```

2. Hide the "+" (create channel) button — since only one channel should exist

3. Remove the collapsible toggle — just show the single channel directly

**Database migration**: Rename the "General" channel to "کانال رسمی شرکت":
```sql
UPDATE public.team_channels 
SET name = 'کانال رسمی شرکت' 
WHERE name = 'General' AND channel_type = 'group';
```

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Filter to show only "کانال رسمی شرکت", hide create button and collapse toggle |
| Database migration | Rename "General" → "کانال رسمی شرکت" |

