

## Fix: Add @Mention Support to Log Note Text Areas

### Problem
The `@username` mention feature only works in the `ChatInput` component (used in Agent Workspace, Inbox, Home). The "Log note" text areas in three key components use plain `Textarea` without any mention detection or autocomplete:

1. **OdooChatter** (`src/components/pipeline/OdooChatter.tsx`) -- "Log note" tab in lead detail
2. **LeadTimeline** (`src/components/pipeline/LeadTimeline.tsx`) -- "Log Activity" form in lead detail
3. **ProjectTimeline** (`src/components/accounting/ProjectTimeline.tsx`) -- note composer in project management

When a user types `@` in these areas, nothing happens -- no popup, no autocomplete. The `@username` text is submitted as raw, unresolved text.

### Solution

Add `@` mention detection and the existing `MentionMenu` component to all three log note text areas, following the same pattern already working in `ChatInput.tsx`.

### Changes per File

**1. `src/components/pipeline/OdooChatter.tsx`**
- Import `MentionMenu` from `@/components/chat/MentionMenu`
- Add state variables: `mentionOpen`, `mentionFilter`, `mentionIndex`
- Wrap the composer `Textarea`'s `onChange` to detect `@(\w*)$` pattern and open the mention menu
- Add `onKeyDown` handler for ArrowUp/ArrowDown/Escape/Enter navigation within the menu
- Render `<MentionMenu>` positioned above the textarea (using a `relative` wrapper)
- On mention select, replace `@partial` text with `@FullName` in the composer value

**2. `src/components/pipeline/LeadTimeline.tsx`**
- Same pattern: import `MentionMenu`, add state, detection logic, keyboard nav, and render the menu above the activity textarea

**3. `src/components/accounting/ProjectTimeline.tsx`**
- Same pattern for the note composer textarea

### Technical Detail

Each component will add roughly the same ~30 lines of logic, mirroring `ChatInput.tsx` lines 56-58 (state), 99-107 (detection), 116-120 (selection handler), 264-268 (keyboard nav), and 348-354 (render). The mention selection callback replaces the trailing `@partial` text with the selected user's full name:

```typescript
// State
const [mentionOpen, setMentionOpen] = useState(false);
const [mentionFilter, setMentionFilter] = useState("");
const [mentionIndex, setMentionIndex] = useState(0);

// Detection (in onChange handler)
const atMatch = newValue.match(/@(\w*)$/);
if (atMatch) {
  setMentionOpen(true);
  setMentionFilter(atMatch[1]);
  setMentionIndex(0);
} else {
  setMentionOpen(false);
}

// Selection
const handleMentionSelect = (item: { label: string }) => {
  setComposerText(prev => prev.replace(/@\w*$/, `@${item.label} `));
  setMentionOpen(false);
};

// Keyboard navigation (in onKeyDown)
if (mentionOpen) {
  if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => i + 1); }
  if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); }
  if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); }
  if (e.key === "Enter") { e.preventDefault(); /* select current item */ }
}
```

The `MentionMenu` component itself is rendered inside a `relative` positioned wrapper around the textarea, so it appears above the input field.

### What is NOT Changed
- The `MentionMenu` component itself (no modifications)
- The `ChatInput` component (already has mention support)
- No database schema or migration changes
- No changes to any other UI, logic, or component outside of these three files

