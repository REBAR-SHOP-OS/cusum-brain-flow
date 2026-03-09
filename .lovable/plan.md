

# Plan: Multi-Platform Selection for Publish & Schedule

## What
Change the Platform selector from single-select to multi-select, so users can choose multiple platforms (e.g., Facebook + Instagram + LinkedIn) and have both Publish and Schedule actions apply to all selected platforms.

## Changes

### `src/components/social/PostReviewPanel.tsx`

1. **Add `localPlatforms` state** (multi-select array, initialized from `[post.platform]`)
2. **Change platform sub-panel** from single-select to multi-select (`multiSelect` prop + `selectedMulti` + `onSaveMulti`)
3. **Update platform display** to show all selected platforms joined by comma
4. **Update Publish button**:
   - Loop over `localPlatforms × localPages` combinations
   - For each combination, call `publishPost()` with the correct platform and page_name
   - Remove the platform-gating condition (`post.platform === "facebook" || ...`) — allow all selected platforms
5. **Update Schedule button**:
   - Primary post gets first platform + first page
   - For remaining platform×page combinations, insert duplicate `social_posts` rows with correct `platform` and `page_name`
6. **Add `handlePlatformsSaveMulti`** replacing `handlePlatformSave` — stores array to `localPlatforms` state (no immediate DB write since the actual platform is set at publish/schedule time)

### No other files changed
- `SelectionSubPanel` already supports `multiSelect` mode (used by Pages)
- `usePublishPost` already accepts platform as a field — works as-is

