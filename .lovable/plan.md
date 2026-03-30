

# Fix Undo/Redo History in Video Editor

## Problem
The undo/redo buttons exist but don't work correctly because:
1. The initial storyboard state is never seeded into the history array
2. `pushHistory` uses a stale `historyIndex` from its closure (the `useCallback` dependency captures the value at creation time, causing it to slice incorrectly)
3. After the first change, `historyIndex` is 0 with only 1 entry, so undo (`historyIndex > 0`) fails — there's no "before" state to restore

## Fix

### File: `src/components/ad-director/ProVideoEditor.tsx`

1. **Seed initial storyboard into history** — Add a `useEffect` that pushes the initial storyboard when the component mounts (or when storyboard first becomes non-empty), setting `history: [storyboard]` and `historyIndex: 0`.

2. **Fix stale closure in `pushHistory`** — Change `pushHistory` to use a functional updater for `setHistory` that reads `historyIndex` from a ref instead of the closure. Add a `historyIndexRef` that stays in sync with `historyIndex`.

3. **Updated logic**:
```typescript
const historyIndexRef = useRef(-1);
const [history, setHistory] = useState<StoryboardScene[][]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

// Keep ref in sync
useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

// Seed initial state
useEffect(() => {
  if (storyboard.length > 0 && history.length === 0) {
    setHistory([storyboard]);
    setHistoryIndex(0);
  }
}, [storyboard]);

const pushHistory = useCallback((snapshot: StoryboardScene[]) => {
  const idx = historyIndexRef.current;
  setHistory(prev => [...prev.slice(0, idx + 1), snapshot]);
  setHistoryIndex(idx + 1);
}, []);
```

This ensures: (a) there's always an initial state to undo to, (b) `pushHistory` reads the current index correctly, (c) undo/redo navigate the stack properly.

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx`

