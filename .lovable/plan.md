

## Add Fullscreen and Minimize Toggle to the Chat Panel

### What This Does
Adds two toggle buttons to the chat panel header in the Job Site Editor:
- **Fullscreen**: Expands the chat to take over the entire right side (hides the preview panel)
- **Minimize**: Collapses the chat panel to a thin strip, giving the preview maximum space

### Changes

**File: `src/pages/WebsiteManager.tsx`**
- Add a `chatMode` state: `"normal" | "fullscreen" | "minimized"`
- When `fullscreen`: Hide the left preview panel entirely; the chat panel takes 100% width
- When `minimized`: Collapse the right panel to a narrow strip (just the tab bar + an expand button), preview gets maximum space
- When `normal`: Current resizable layout (70/30 split)
- Pass `chatMode` and `onChatModeChange` props down to `WebsiteChat`

**File: `src/components/website/WebsiteChat.tsx`**
- Add `Maximize2`, `Minimize2` icons from lucide-react to the header bar (next to the existing trash button)
- Fullscreen button: toggles between fullscreen and normal
- Minimize button: toggles between minimized and normal
- In minimized state, the parent hides the chat body; only a small expand button is visible

### Technical Details

In `WebsiteManager.tsx`:
- Conditionally render the `ResizablePanelGroup` based on `chatMode`
- Fullscreen: render only the right panel (no `ResizablePanel` split)
- Minimized: set right panel `defaultSize` to ~5 and hide content, or conditionally render a collapsed strip
- Normal: keep existing 70/30 resizable layout

In `WebsiteChat.tsx`:
- Accept new props: `chatMode?: "normal" | "fullscreen" | "minimized"` and `onChatModeChange?: (mode: "normal" | "fullscreen" | "minimized") => void`
- Add icon buttons in the header between the title and the trash icon:
  - Fullscreen toggle (`Maximize2` / `Minimize2`)
  - Minimize toggle (`Minus` / `Plus`)

