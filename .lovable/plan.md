

## Plan: Simplify Ad Director to Chat-First Flow

### Problem
The current Ad Director UI is overly complex with many unused tools (Stock Images, Graphics, Templates, Filters, etc.) in a sidebar, plus a multi-step wizard. The user wants a simple flow:

1. **Chat screen** — Write a prompt (like a chat), upload images, select aspect ratio
2. **After generation** — Show the video with two buttons: ✅ Approve / ✏️ Edit Video
3. **Edit mode** — Takes to the existing ProVideoEditor for detailed editing

### Changes

**1. Simplify `AdDirector.tsx` page** — Remove the complex sidebar (`AdDirectorSidebar`). Replace with a clean, minimal layout.

**2. Create `AdDirectorChatInput.tsx`** — A chat-style prompt input at the bottom of the screen with:
- Text input (like a chat message box)
- Image upload button (paperclip icon)
- Aspect ratio selector (compact pill buttons: 16:9, 9:16, 1:1, 4:3)
- Send/Generate button

**3. Create `AdDirectorChatFlow.tsx`** — New main component replacing the complex `AdDirectorContent` rendering logic. Three states:
- **Idle**: Shows the chat input centered on screen (like ChatGPT empty state)
- **Generating**: Shows progress with the prompt displayed as a "sent message" bubble
- **Result**: Shows the generated video with two action buttons:
  - ✅ **Approve** — Downloads or saves the video
  - ✏️ **Edit Video** — Transitions to `ProVideoEditor`

**4. Simplify `AdDirectorContent.tsx`** — Keep all the existing generation logic (handleAnalyze, generateScene, handleExport etc.) but rewire the UI rendering to use the new chat flow instead of the step wizard. The backend pipeline remains unchanged.

**5. Remove sidebar rendering** — Remove `AdDirectorSidebar` import and all sidebar tab panel logic from the page. The sidebar tools (Stock Images, Templates, Graphics, etc.) are still accessible inside the Edit mode via `ProVideoEditor`.

### UI Layout

```text
┌──────────────────────────────────────┐
│                                      │
│     (empty state / video result)     │
│                                      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [📎] Type your video idea   [→] │
│  │  [16:9] [9:16] [1:1] [4:3]      │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘

After generation:
┌──────────────────────────────────────┐
│         ┌──────────────┐             │
│         │  ▶ Video      │             │
│         └──────────────┘             │
│     [✅ Approve]  [✏️ Edit Video]    │
└──────────────────────────────────────┘
```

### What stays the same
- All backend edge functions (ad-director-ai, video generation)
- ProVideoEditor for full editing
- Video generation pipeline (analyze → storyboard → generate → stitch)
- Brand kit, export dialog
- Project history (simplified — shown as recent items in the chat view)

### Files modified
- `src/pages/AdDirector.tsx` — Remove sidebar, simplify layout
- `src/components/ad-director/AdDirectorContent.tsx` — Rewire UI to chat-first flow with approve/edit buttons after generation
- New: `src/components/ad-director/ChatPromptBar.tsx` — Chat-style input with upload + ratio selector

