

## Plan: Add "Edit Caption" Button Next to "Regenerate Caption"

### Current State
The caption `Textarea` (line 605-611) is already editable with auto-save — but it may not be obvious to users. The "Regenerate caption" button is prominent, but there's no explicit "Edit" button.

### Change

**File: `src/components/social/PostReviewPanel.tsx` (lines 644-682)**

Add an "Edit caption" button next to "Regenerate caption" that:
- Scrolls to and focuses the caption textarea when clicked
- Uses a `Pencil` icon for clarity
- Is disabled when the post is already published (same as Regenerate)

This is a simple UX improvement — a `useRef` on the caption textarea + `scrollIntoView()` + `focus()` on click.

### Technical Detail
- Add a `captionRef` using `useRef<HTMLTextAreaElement>` 
- Attach it to the caption `Textarea` via `ref={captionRef}`
- The "Edit caption" button calls `captionRef.current?.focus()` and `captionRef.current?.scrollIntoView({ behavior: 'smooth' })`
- Place it in the existing `flex gap-2` div alongside "Regenerate caption"
- Import `Pencil` from lucide-react

### Files
- `src/components/social/PostReviewPanel.tsx` — add ref + Edit button

