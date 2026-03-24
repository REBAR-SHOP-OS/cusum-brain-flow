

## Change Voice Record Button Icon

### Problem
The voice recorder button (circled in the screenshot) uses the same `Mic` icon as the voice-to-text button next to it, making them visually confusing.

### Fix

**File**: `src/components/teamhub/MessageThread.tsx` (line 937)

Change the voice recorder button icon from `Mic` to `AudioLines` (or `Radio`) to visually distinguish it from the speech-to-text mic button. Also add a subtle colored background to make it stand out:

- Replace `<Mic className="w-5 h-5" />` with `<AudioLines className="w-5 h-5" />`
- Add a light accent background: `bg-primary/10 text-primary hover:bg-primary/20` to differentiate it visually
- Add the `AudioLines` import from lucide-react

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Change voice recorder icon from `Mic` to `AudioLines`, add accent styling |

