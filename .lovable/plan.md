

## Add Live Note-Taker for All Conversations

### Problem
When a salesperson is on a call or having a conversation, they need a way to capture live notes automatically via speech-to-text transcription — directly from the Sales Lead Drawer.

### Approach
Add a "Live Notes" button next to the existing email/phone actions. When clicked, it opens an inline panel that uses the existing `useSpeechRecognition` hook to transcribe speech in real-time and automatically saves the transcript as a note activity in the lead's timeline (via `SalesLeadChatter`'s activity system).

### Changes

**File**: `src/components/sales/LiveNoteTaker.tsx` (NEW)
- A compact panel component with:
  - Start/Stop recording button with pulsing indicator
  - Live transcript display (scrolling, interim + final text)
  - Auto-saves the full transcript as a "note" activity on the lead when stopped
  - Uses existing `useSpeechRecognition` hook
  - Uses existing `useSalesLeadActivities().create` to save notes

**File**: `src/components/sales/SalesLeadDrawer.tsx`
- Add a `NotebookPen` icon button next to the email/phone buttons (visible to all users, not just when phone/email exists)
- Toggle state `noteTakerOpen` to show/hide `LiveNoteTaker` panel inline below the info grid
- Pass `salesLeadId` and `companyId` to the note-taker

### UI Layout
```text
┌─────────────────────────────────┐
│  Contact: Ali      Company: EPC │
│  Email: [✉]  Phone: [📞]  [📝] │  ← new note-taker button
├─────────────────────────────────┤
│  🔴 Live Note-Taker    [Stop]  │  ← appears when toggled
│  ─────────────────────────────  │
│  "okay so the client wants..."  │
│  "delivery by next Friday..."   │
│  listening...                   │
└─────────────────────────────────┘
```

When the user stops recording, the full transcript is automatically posted as a note in the Timeline tab with a "Live Note" label.

| File | Change |
|---|---|
| `src/components/sales/LiveNoteTaker.tsx` | NEW — speech-to-text panel with auto-save |
| `src/components/sales/SalesLeadDrawer.tsx` | Add note-taker toggle button and render panel |

