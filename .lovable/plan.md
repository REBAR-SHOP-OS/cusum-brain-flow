
## Fix: Chat Controls Hidden When Content Overflows in Fullscreen

### Problem
In fullscreen mode, when there's a lot of chat content, the messages overflow and push the minimize/fullscreen buttons out of view. The header stays at the top but the overall container grows beyond the viewport.

### Root Cause
The fullscreen wrapper `<div className="flex-1">` around `rightPanelContent` (line 136 in `WebsiteManager.tsx`) doesn't constrain its height, so the inner content can expand indefinitely instead of scrolling.

### Solution
Add `overflow-hidden` and `min-h-0` to the fullscreen container div so flex children are properly constrained within the viewport height.

### File Change: `src/pages/WebsiteManager.tsx`

**Line 136** - Change:
```typescript
<div className="flex-1">{rightPanelContent}</div>
```
To:
```typescript
<div className="flex-1 overflow-hidden min-h-0">{rightPanelContent}</div>
```

This single class addition ensures the chat panel stays within the viewport bounds and the header with minimize/fullscreen buttons remains always visible and accessible, regardless of content length.
