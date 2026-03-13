

# Remove Neel Approval Gate for "Publish Now" Button

## Problem
Currently, clicking "Publish Now" is blocked by Neel's approval check — both on the frontend and in the `social-publish` edge function. The user wants "Publish Now" to bypass this gate (manual publish = immediate), while keeping the gate for scheduled/cron publishing.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx` — Remove frontend guard
Remove lines 751-755 (the `neel_approved` check that blocks publishing and shows a toast).

### 2. `supabase/functions/social-publish/index.ts` — Add bypass parameter
- Accept a new optional `force_publish` boolean in the request body
- When `force_publish` is true, skip the Neel approval check (lines 117-130)
- The cron function does NOT send `force_publish`, so scheduled posts still require Neel's approval

### 3. `src/hooks/usePublishPost.ts` — Pass `force_publish: true`
Add `force_publish: true` to the body sent to the `social-publish` edge function, signaling this is a manual publish.

### Result
- **Publish Now** → publishes immediately, no Neel approval needed
- **Scheduled publish (cron)** → still requires Neel approval (unchanged)

