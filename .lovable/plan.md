

# Add SUPPORT Link to Team Hub Direct Messages

## What Changes

Add a colorful "SUPPORT" entry at the top of the **Direct Messages** section in the Team Hub sidebar (`ChannelSidebar.tsx`). Clicking it navigates to `/support-inbox`. It will also show a live count of unread/open support conversations.

**No other files or features will be modified.**

## Visual Design

- A button styled similarly to DM entries but with a distinct colored icon
- Orange/amber gradient circle icon (matching the support widget brand) with a headset icon
- Label: **SUPPORT**
- Badge showing the count of open support conversations
- Placed at the top of the Direct Messages list, always visible

## Technical Details

### File: `src/components/teamhub/ChannelSidebar.tsx`

1. Import `useNavigate` from react-router-dom and `HeadphonesIcon` from lucide-react
2. Add a small inline query (or state) to fetch the count of open `support_conversations` from the database
3. Insert a "SUPPORT" button at the top of the DMs section, before the existing DM channel list
4. On click, navigate to `/support-inbox`
5. Style the icon with an orange/amber background to visually distinguish it from regular DMs

No changes to any other component, page, hook, or styling.
