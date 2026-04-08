

# Remove Direct Messages Section from Chat UI

## Problem
The user wants the "Direct Messages" section completely removed from the chat popover (circled in the screenshot).

## Changes

### 1. `src/components/chat/DockChatBar.tsx`
- Delete lines 227-245 (the entire `{/* DM channels */}` block that renders the Direct Messages list)

### 2. `src/components/layout/GlobalChatPanel.tsx`
- Delete lines 155-175 (the entire `{/* DMs */}` block that renders the Direct Messages list)

Both files will retain the "Start a Chat" / team members section and group channels — only the DM channel listing is removed.

