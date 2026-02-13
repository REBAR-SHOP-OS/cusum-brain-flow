

# Enhance Live Chat: Toggle Button + Full Input Toolbar

## Two Changes

### 1. Floating Button Toggle
Clicking the floating button when already on `/chat` will navigate back (close chat). Currently it only opens.

**File:** `src/components/vizzy/FloatingVizzyButton.tsx`
- Import `useLocation` from react-router-dom
- If `location.pathname === "/chat"`, call `navigate(-1)`; otherwise navigate to `/chat`

### 2. Add All Chat Tools to the Input Area

The full-screen chat currently has a plain textarea + send button. We'll add all the available chat components to it:

- **Formatting Toolbar** (Bold, Italic, Code, List, Link) -- shown above the textarea
- **Quick Templates** (template icon button) -- in the toolbar row below textarea
- **Emoji Picker** (smiley icon button) -- in the toolbar row
- **Voice Input** (microphone button) -- in the toolbar row
- **Slash Commands** (triggered by typing `/`) -- popup menu above input
- **Mention Menu** (triggered by typing `@`) -- popup menu above input

**File:** `src/pages/LiveChat.tsx`
- Import all chat components: `FormattingToolbar`, `QuickTemplates`, `EmojiPicker`, `VoiceInputButton`, `SlashCommandMenu`, `MentionMenu`
- Add state for: `showFormatting`, `mentionOpen`, `mentionFilter`, `mentionIndex`, `slashOpen`, `slashFilter`, `slashIndex`
- Add voice input support using `webkitSpeechRecognition` (same pattern as existing ChatInput)
- Detect `@` and `/` typing to trigger mention/slash menus
- Add a toolbar row below the textarea with: Quick Templates, Emoji, Voice, Formatting toggle
- Wire formatting toolbar to insert markdown syntax around selection in textarea
- Wire slash commands and mentions to replace trigger text in input

### Layout of Enhanced Input Area

```text
+----------------------------------------------+
| [FormattingToolbar - Bold/Italic/Code/etc]   |  (togglable)
+----------------------------------------------+
| [SlashCommandMenu popup]  [MentionMenu popup]|  (contextual popups)
+----------------------------------------------+
| [ textarea ............................. ]    |
+----------------------------------------------+
| [Templates] [Emoji] [Voice] [Format] | [Send]|
+----------------------------------------------+
```

### Technical Details

| File | Change |
|------|--------|
| `src/components/vizzy/FloatingVizzyButton.tsx` | Add `useLocation`, toggle navigation logic |
| `src/pages/LiveChat.tsx` | Import and integrate FormattingToolbar, QuickTemplates, EmojiPicker, VoiceInputButton, SlashCommandMenu, MentionMenu |

No new files needed -- all components already exist and just need to be wired into the LiveChat page.
