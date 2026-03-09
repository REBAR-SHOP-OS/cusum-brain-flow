

# Add "Publish Now" Button to Post Review Panel

## What
Add a **"Publish Now"** button above the existing "Schedule" button in the `PostReviewPanel` footer. This button will immediately publish the post to the selected platforms/pages using the existing `usePublishPost` hook and `social-publish` edge function.

## Changes

### `src/components/social/PostReviewPanel.tsx`
1. Import `usePublishPost` from `@/hooks/usePublishPost` and the `Send` icon from lucide-react
2. Initialize `const { publishPost, publishing } = usePublishPost()` inside the component
3. Add a **"Publish Now"** button above the Schedule button in the footer actions section (line ~469), which:
   - Validates that at least one platform and page are selected
   - Iterates over all platform×page combos (same logic as Schedule)
   - Calls `publishPost()` for each combo
   - Shows success toast and closes the panel
   - Displays a loading spinner while publishing

The button will be styled with a prominent color (e.g., `bg-green-600`) to differentiate from Schedule, with a `Send` icon.

