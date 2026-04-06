

# Fix: Vizzy Brain Panel & Button Issues

## Root Cause

Two problems identified:

1. **AnimatePresence ref error**: `AnimatePresence` wraps `VizzyBrainPanel` and `VizzyVoiceChat` directly. These are plain function components, but `AnimatePresence` tries to pass a ref to its direct children. This causes the React warning and can break exit animations / event handling.

2. **Brain button not visually distinct**: The Brain action button uses `bg-accent text-accent-foreground` which may blend with the background or be invisible depending on theme.

## Fix

### File: `src/components/vizzy/FloatingVizzyButton.tsx`

Remove `AnimatePresence` wrappers around `VizzyBrainPanel` and `VizzyVoiceChat`. These panels already have their own `motion.div` with enter/exit animations internally, but since they're not direct `motion.*` children of `AnimatePresence`, the ref forwarding fails. Replace with simple conditional rendering:

```tsx
// Before (broken):
<AnimatePresence>
  {showVoiceChat && (
    <VizzyVoiceChat onClose={() => setShowVoiceChat(false)} />
  )}
</AnimatePresence>

<AnimatePresence>
  {showBrainPanel && (
    <VizzyBrainPanel onClose={() => setShowBrainPanel(false)} />
  )}
</AnimatePresence>

// After (fixed):
{showVoiceChat && (
  <VizzyVoiceChat onClose={() => setShowVoiceChat(false)} />
)}

{showBrainPanel && (
  <VizzyBrainPanel onClose={() => setShowBrainPanel(false)} />
)}
```

Also update the Brain action button styling to match the teal theme used by Voice button, making it clearly visible:

```tsx
<motion.button
  ...
  onClick={onBrainClick}
  className="absolute top-0 left-0 w-11 h-11 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 cursor-pointer"
  style={{
    background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(270 60% 60%))",
  }}
  aria-label="Open Vizzy Brain"
>
  <Brain size={18} className="text-white" />
</motion.button>
```

This gives the Brain button a distinct purple gradient, clearly differentiating it from Voice (teal) and Chat (primary).

## Summary

- Remove broken `AnimatePresence` wrappers (fixes ref error + potential click/render issues)
- Give Brain button a visible, distinct style
- Single file change: `FloatingVizzyButton.tsx`

