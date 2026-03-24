

## Remove Grammar Check Button from Composer Toolbar

### Change

**File**: `src/components/teamhub/MessageThread.tsx`
- Remove the SpellCheck button block (lines 923-938) from the composer toolbar
- Remove `SpellCheck` from the lucide-react import (line 27)
- Remove the `useGrammarCheck` hook usage if no longer referenced elsewhere in the file

### Result
Toolbar order becomes: Emoji → Voice Input → Voice Record → Attach → Language Selector

