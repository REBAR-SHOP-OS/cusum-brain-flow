

# Pixel Agent: Post Cards with View Panel (UI-Only)

## What Changes

### 1. New Component: `PixelPostCard`
**File:** `src/components/social/PixelPostCard.tsx` (new)

A compact card displayed inline in chat messages when Pixel generates posts. Each card shows:
- Agent avatar + "Created a post" text
- Status badge (Published / Scheduled / Draft)
- **View** button on the right

Clicking "View" triggers a callback to open the detail panel.

### 2. New Component: `PixelPostViewPanel`
**File:** `src/components/social/PixelPostViewPanel.tsx` (new)

A right-side sliding panel (Sheet) that opens when the user clicks "View" on a post card. Contains:

- **Header**: "Social Media Post" title with close (X) button
- **Image preview**: Shows the generated image for the post
- **Action buttons**: "Regenerate image" and "AI Edit" (UI only, non-functional for now)
- **Calendar section**: A date picker (using the existing Calendar component) and a time picker (hour:minute selector) so the user can choose when to schedule the post
- **Social accounts selector**: Icons/buttons for Instagram, Facebook, YouTube, TikTok -- the user can toggle which accounts to post to. These are UI-only placeholders (no real accounts connected yet)
- **"View in calendar"** button (UI only)
- **"Duplicate"** button (UI only)

No actual publishing or scheduling happens -- purely visual/UI.

### 3. Integration into `AgentWorkspace.tsx`
**File:** `src/pages/AgentWorkspace.tsx` (edit, social agent section only)

- Import `PixelPostViewPanel`
- Add state: `viewingPost` (the post data to show in the panel)
- When `agentId === "social"`, render `PixelPostViewPanel` alongside the chat
- Pass a callback to `ChatThread` so post cards can trigger opening the panel

### 4. Custom Rendering for Pixel's Chat Messages
**File:** `src/components/social/PixelChatRenderer.tsx` (new)

A wrapper that detects when Pixel's agent messages contain generated post data (images with social-images URL pattern) and renders them as `PixelPostCard` components instead of plain markdown. Non-post messages render normally with `RichMarkdown`.

### What Does NOT Change
- No other agents are affected
- No database changes
- No API calls or publishing logic
- No changes to existing components (ChatMessage, RichMarkdown, PostReviewPanel, etc.)
- The existing SocialMediaManager page remains untouched

## Technical Details

### PixelPostCard layout
```text
[ Avatar | "Created a post"     | [View] ]
[        | check Published      |        ]
```

### PixelPostViewPanel layout
```text
+----------------------------------+
| X          Social Media Post     |
+----------------------------------+
| [  Generated Image Preview  ]   |
|                                  |
| [Regenerate image] [AI Edit]    |
|                                  |
| --- Schedule ---                 |
| [Calendar date picker]           |
| [Time: HH:MM picker]            |
|                                  |
| --- Accounts ---                 |
| [IG] [FB] [YT] [TT]            |
|                                  |
| [View in calendar]               |
| [Duplicate]                      |
+----------------------------------+
```

### Files Summary

| File | Action |
|------|--------|
| `src/components/social/PixelPostCard.tsx` | Create |
| `src/components/social/PixelPostViewPanel.tsx` | Create |
| `src/components/social/PixelChatRenderer.tsx` | Create |
| `src/pages/AgentWorkspace.tsx` | Edit (social section only) |

