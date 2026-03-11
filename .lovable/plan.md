

## Show All Platform Pages in PostReviewPanel

### Problem
When clicking a platform-grouped card (e.g., Facebook ×6), only the first post is passed to `PostReviewPanel`. The Pages section then shows only that one post's `page_name`, not all 6 pages.

### Solution
Pass all posts belonging to the clicked platform group alongside the selected post, so `PostReviewPanel` can populate `localPages` with all unique page names from that group.

### Changes

**`src/components/social/SocialCalendar.tsx`**
- Add a new prop `onPostClickWithGroup?: (post: SocialPost, groupPosts: SocialPost[]) => void`
- When clicking a platform group card (non-selection mode), call `onPostClick(firstPost)` **and** pass the full `posts` array via a new callback, OR change `onPostClick` signature to include sibling posts

Simpler approach — add an optional `onGroupClick` prop:
- `onGroupClick?: (post: SocialPost, siblingPages: string[]) => void`
- When present, use it instead of `onPostClick`; pass `firstPost` + unique page names from the group

**`src/pages/SocialMediaManager.tsx`**
- Add state: `const [groupPages, setGroupPages] = useState<string[]>([])`
- Handle group click: `onGroupClick={(post, pages) => { setSelectedPost(post); setGroupPages(pages); }}`
- Pass `groupPages` to `PostReviewPanel`

**`src/components/social/PostReviewPanel.tsx`**
- Add optional prop `groupPages?: string[]`
- In the `useEffect` that syncs on `post?.id`, if `groupPages` is provided and non-empty, use it for `setLocalPages` instead of just `[post.page_name]`

### Result
Clicking a Facebook ×6 card opens the review panel with all 6 page names listed in the Pages section.

