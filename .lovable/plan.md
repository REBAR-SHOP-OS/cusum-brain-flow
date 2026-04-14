

## Plan: Fullscreen Mode on Fit View Click

### Problem
When the user clicks the Fit View button (circled in the screenshot), only the zoom resets — the sidebar (layers panel) and top header remain visible, reducing the diagram area.

### Approach
Add a fullscreen toggle state. When the user clicks the Fit View button on the ReactFlow Controls, the sidebar and header hide, giving the diagram the full page. A floating button appears to exit fullscreen.

Since ReactFlow's built-in Controls `fitView` button can't be easily intercepted, we'll add a custom fullscreen toggle button and hide the default Controls `fitView`.

### Changes (`src/pages/Architecture.tsx`)

1. **Add state**: `const [isFullscreen, setIsFullscreen] = useState(false)`

2. **Hide header + sidebar when fullscreen**:
   - Header (`<header>`) gets `className={... isFullscreen ? "hidden" : ""}`
   - Mobile layer bar (`md:hidden` div) gets same treatment
   - Sidebar (`hidden md:flex w-44`) gets `isFullscreen ? "!hidden" : ""`

3. **Add custom Fit View + Fullscreen button** as a floating overlay on the canvas:
   - A small button group in top-right of the canvas area
   - "Fullscreen" button: toggles `isFullscreen`, also calls `reactFlowInstance.fitView()`
   - When in fullscreen, show an "Exit Fullscreen" button (e.g., Minimize icon)

4. **Also call fitView** when entering fullscreen, with a small delay to let layout reflow

5. **TopBar**: Hide the TopBar when fullscreen using a CSS class on the page wrapper, or conditionally render

### Files
| File | Change |
|---|---|
| `src/pages/Architecture.tsx` | Add fullscreen state, hide header/sidebar/topbar conditionally, add floating toggle button, call fitView on toggle |

### Result
- Clicking the fullscreen button hides the sidebar, header, and top navigation bar
- The diagram fills the entire screen with a fitView animation
- A floating button allows exiting fullscreen mode back to normal layout

