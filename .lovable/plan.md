

## Move Check Button Next to Emoji Icon

### Problem
The grammar check button ("A Check") currently sits after the attach file icon, far from the emoji picker. The user wants it placed right next to the emoji/sticker icon.

### Change

**File**: `src/components/teamhub/MessageThread.tsx`

Move the SpellCheck button block (lines 963-978) to right after the `<EmojiPicker>` component (line 922), so the toolbar order becomes:

1. Emoji picker
2. **Check (SpellCheck)** — moved here
3. Voice input (VoiceInputButton)
4. Voice record (AudioLines)
5. Attach file (Paperclip)
6. Language selector (Popover)

No logic changes — just reordering the JSX.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Move SpellCheck button to right after EmojiPicker |

