

## Disable Fields for Published Posts

### Problem
When a post has status `published`, the user can still change Publish date, Content type, Platforms, and Pages — this should not be allowed.

### Changes in `src/components/social/PostReviewPanel.tsx`

1. **Add `isPublished` flag**: `const isPublished = post.status === "published";`

2. **Publish date popover** (line ~446): Wrap in condition — if published, render as a static `div` instead of a `Popover` trigger (no click interaction).

3. **Content type button** (line ~495): Add `disabled` behavior — if published, use a `div` with `opacity-60 cursor-not-allowed` instead of a clickable button, remove `onClick`.

4. **Platforms button** (line ~507): Same treatment — disable click when published.

5. **Pages button** (line ~519): Same treatment — disable click when published.

6. **Footer actions**: Hide "Publish Now", "Decline", "Schedule", and "Delete post" buttons when published. Optionally show a "Published ✅" badge instead.

### Implementation Pattern
```typescript
const isPublished = post.status === "published";

// For each field button:
{isPublished ? (
  <div className="w-full rounded-lg border bg-card p-3 opacity-60 cursor-not-allowed">
    <p className="text-xs text-muted-foreground mb-1">Platforms ({localPlatforms.length})</p>
    <span className="text-sm font-medium">{platformsDisplay}</span>
  </div>
) : (
  <button onClick={() => setSubPanel("platform")} className="...">
    {/* existing content */}
  </button>
)}
```

