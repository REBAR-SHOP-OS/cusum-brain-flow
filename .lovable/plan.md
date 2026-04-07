

# Unify Chat Icon Widget with Team Hub

## Current State
The floating chat icon (`DockChatBar`) and Team Hub (`/team-hub`) already share the same data layer (channels, profiles, DMs, messages). However, they are treated as separate systems:
- The chat icon **hides itself** when the user is on `/team-hub` (line 57, 126 in `DockChatBar.tsx`)
- The DockChatBox "expand" button navigates to `/team-hub` and **closes** the chat box

## Problem
The user wants the chat icon to always be visible as a consistent widget — it should never disappear, even on the Team Hub page. The chat icon IS Team Hub's widget form; they must behave as one unified system.

## Changes

### 1. `src/components/chat/DockChatBar.tsx`
- **Remove the Team Hub hide logic**: Delete the `isTeamHub` check (lines 57, 126) so the floating chat button is always visible, including on `/team-hub`
- The widget remains fully functional everywhere — same channels, same DMs, same data

### 2. `src/components/chat/DockChatBox.tsx`
- **Update the expand button**: Instead of closing the chat and navigating to `/team-hub`, keep the expand button but don't close the active chat — just navigate to Team Hub so the user can see the full view while keeping the widget available
- Alternative: on Team Hub page, the expand button could scroll/focus the relevant channel in the sidebar instead of navigating

### No other changes needed
The data layer (`useTeamChannels`, `useTeamMessages`, `useSendMessage`, `useOpenDM`) is already shared between both. No database changes required.

