

## Add Delete Button + Spellcheck Before Send — Across All Chat Apps

### What the User Wants
1. **Delete button** on individual messages (not just clear-all) across all chat interfaces
2. **Spellcheck before send** — the grammar-check feature (already in `Textarea` component) needs to be available in ALL text input areas, including raw `<textarea>` elements that bypass the `Textarea` component

### Current State

**Spellcheck**: Only works in components using the `<Textarea>` component from `src/components/ui/textarea.tsx`. Most chat inputs use raw `<textarea>` elements — so they get NO spellcheck.

| App | Input Type | Has Spellcheck | Has Delete Msg |
|---|---|---|---|
| LiveChat (main Vizzy) | raw `<textarea>` | No | No |
| LiveChatWidget (floating) | raw `<textarea>` | No | No |
| PublicChatWidget (customer) | raw `<textarea>` | No | No |
| WebsiteChat | raw `<textarea>` | No | No |
| IntelligencePanel | `<Textarea>` component | Yes ✅ | No |
| ComposeEmail | `<Textarea>` component | Yes ✅ | N/A |
| ComposeEmailDialog | `<Textarea>` component | Yes ✅ | N/A |
| BulkSMSDialog | `<Textarea>` component | Yes ✅ | N/A |
| TeamHub MessageThread | raw `<textarea>` | No | No |

### Plan

#### Change 1: Create a reusable `useGrammarCheck` hook
**File**: `src/hooks/useGrammarCheck.ts` (new)

Extract the grammar-check logic from `textarea.tsx` into a standalone hook so any input can use it:
```typescript
export function useGrammarCheck() {
  const [checking, setChecking] = useState(false);
  const check = async (text: string): Promise<{ corrected: string; changed: boolean }> => {
    // calls grammar-check edge function
  };
  return { check, checking };
}
```

#### Change 2: Add spellcheck button to all chat input areas
Add a small "Check" button (same SpellCheck icon) next to the Send button in these files:

| File | Change |
|---|---|
| `src/pages/LiveChat.tsx` | Add spellcheck button in toolbar row (next to emoji, voice, etc.) |
| `src/components/layout/LiveChatWidget.tsx` | Add spellcheck button next to send |
| `src/components/landing/PublicChatWidget.tsx` | Add spellcheck button next to send |
| `src/components/website/WebsiteChat.tsx` | Add spellcheck button next to send |
| `src/components/teamhub/MessageThread.tsx` | Add spellcheck button in input toolbar |

Each will use `useGrammarCheck` hook — on click, it checks the current input text and replaces it with the corrected version.

#### Change 3: Add delete button on individual messages
Add a hover-reveal delete (Trash2) button on each message bubble across all chat interfaces:

**For Vizzy chats** (LiveChat, LiveChatWidget, IntelligencePanel, WebsiteChat):
- These use `useAdminChat` which stores messages in local state. Add a `deleteMessage(id)` function that filters out the message by ID.
- Show a small Trash2 icon on hover (top-right corner of message bubble)

**For PublicChatWidget**:
- Same pattern — local state, filter by ID on delete

**For TeamHub MessageThread**:
- Messages come from DB (`team_messages` table). Delete requires a DB call + optimistic UI update. Add delete to the existing message actions.

**File**: `src/hooks/useAdminChat.ts` — Add `deleteMessage` function to the hook return

#### Change 4: Add `deleteMessage` to useAdminChat hook
**File**: `src/hooks/useAdminChat.ts`

```typescript
const deleteMessage = useCallback((msgId: string) => {
  setMessages(prev => prev.filter(m => m.id !== msgId));
}, []);
```

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useGrammarCheck.ts` | New hook — extracted grammar-check logic |
| `src/hooks/useAdminChat.ts` | Add `deleteMessage` function |
| `src/pages/LiveChat.tsx` | Add spellcheck button + delete on messages |
| `src/components/layout/LiveChatWidget.tsx` | Add spellcheck button + delete on messages |
| `src/components/layout/IntelligencePanel.tsx` | Add delete on messages (already has spellcheck via Textarea) |
| `src/components/landing/PublicChatWidget.tsx` | Add spellcheck button + delete on messages |
| `src/components/website/WebsiteChat.tsx` | Add spellcheck button + delete on messages |
| `src/components/teamhub/MessageThread.tsx` | Add spellcheck button + delete on messages (DB delete) |

