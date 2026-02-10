

## Add "Add to Brain" and "Add to Task" Across All Conversations

Currently these action buttons exist only in the AI Agent chat (`MessageActions`) and the Unified Inbox (`CommunicationViewer`). This plan adds them to every remaining conversation interface.

### What Changes

**1. Create a shared `ContentActions` component** (`src/components/shared/ContentActions.tsx`)
- A compact, reusable row of icon buttons: Copy, Add to Brain, Add to Task
- Accepts `content: string` and optional `title: string` props
- Reuses the same Brain insert logic from `MessageActions` and the same `CreateTaskDialog`
- Can be dropped into any message bubble or content panel with one line

**2. Surfaces that get the new buttons:**

| Surface | File | Current State | Change |
|---------|------|---------------|--------|
| Cal/Gauge Estimation Chat | `CalChatMessage.tsx` | No actions | Add `ContentActions` below agent messages |
| Admin Console (Intelligence Panel) | `IntelligencePanel.tsx` | No actions | Add `ContentActions` below assistant messages |
| TeamHub Channel Messages | `MessageThread.tsx` | Emoji/thread/more on hover | Add Brain + Task icons to hover action row |
| Gmail Email Viewer | `EmailViewer.tsx` | Task only (custom modal) | Add Brain button next to existing task button |
| Inbox Email Viewer | `InboxEmailViewer.tsx` | Task only | Add Brain button alongside existing `AddToTaskButton` |
| Inbox Detail View | `InboxDetailView.tsx` | Task only | Add Brain button alongside existing `AddToTaskButton` |
| Call Summary Dialog | `CallSummaryDialog.tsx` | Task creation built-in | Add Brain button to save summary to knowledge |
| Call Analysis Dialog | `CallAnalysisDialog.tsx` | Tasks built-in, no Brain save | Add Brain button to save analysis to knowledge |
| Pipeline Lead Email | `LeadEmailContent.tsx` | No actions | Add `ContentActions` below email body |

**3. Files NOT changed:**
- `ChatMessage.tsx` / `MessageActions.tsx` -- already has both
- `CommunicationViewer.tsx` -- already has both

### Technical Details

**New shared component** (`src/components/shared/ContentActions.tsx`):
```typescript
// Compact icon row: Copy | Brain | Task
// Props: content, title (optional), size ("sm" | "xs")
// Uses useCompanyId() + supabase insert to knowledge table
// Uses CreateTaskDialog for task creation
```

**CalChatMessage.tsx** -- Add after the metadata timestamp block (line ~160), only for agent messages:
```tsx
{!isUser && message.content && (
  <ContentActions content={message.content} title={message.content.slice(0, 80)} />
)}
```

**IntelligencePanel.tsx** -- Add inside the assistant message block (after the timestamp, line ~92):
```tsx
{msg.role === "assistant" && (
  <ContentActions content={msg.content} size="xs" />
)}
```

**MessageThread.tsx** -- Add Brain and Task icon buttons to the existing hover actions row (lines 422-432):
```tsx
<Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddToBrain}>
  <Brain className="w-3.5 h-3.5" />
</Button>
<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTaskOpen(true)}>
  <CheckSquare className="w-3.5 h-3.5" />
</Button>
```

**EmailViewer.tsx** -- Add a Brain icon button next to the existing CheckSquare task button (line 27-29).

**InboxEmailViewer.tsx** and **InboxDetailView.tsx** -- Add a Brain button next to existing `AddToTaskButton` in the footer bar.

**CallSummaryDialog.tsx** -- Add "Save to Brain" button next to "Create All" tasks button.

**CallAnalysisDialog.tsx** -- Add "Save to Brain" button in the summary tab to persist the analysis.

**LeadEmailContent.tsx** -- Add `ContentActions` below the email body section, passing the email subject + body as content.

### No database or backend changes needed
The `knowledge` table and `tasks` table already exist with proper RLS. All inserts go through the existing Supabase client.
