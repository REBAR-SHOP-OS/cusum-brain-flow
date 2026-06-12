Plan to fix the Instagram publish failure at the root

Findings
- The screenshot error is the same Meta code 2 media-ingestion failure: Instagram cannot fetch/process the image URL.
- The failed database row is already marked failed, and it used the original PNG URL: `social-media-assets/images/6b789...png`.
- Current code now tries to create an `ig-ready/*.jpg` derivative, but it still has two weaknesses:
  - If JPEG materialization fails or is not immediately public, it silently falls back to the original PNG URL and still calls Meta.
  - Manual publish and cron publish pass the original `image_url` into each IG page publish; the prepared URL is not persisted/centralized before fan-out, so retries can keep showing/using the original failed media path.

Implementation plan
1. Make IG image preparation mandatory before Meta calls
   - For Instagram non-video posts/stories, convert the source image to a JPEG derivative in the public social media storage path: `social-media-assets/ig-ready/<hash>.jpg`.
   - Verify that the final JPEG URL is publicly readable with `HEAD` and fallback `GET` before any Meta API call.
   - If preparation fails, stop before Meta and show a clear internal error like “Instagram image preparation failed; retry after re-upload/regenerate,” instead of sending the original URL and producing Meta code 2.

2. Centralize the prepared media URL once per publish run
   - Prepare the Instagram image once in `social-publish` before publishing to the selected pages.
   - Pass the same verified JPEG URL to all IG pages instead of re-preparing per page.
   - Apply the same shared preparation path in `social-cron-publish` so scheduled publishing behaves exactly like manual publishing.

3. Persist the prepared URL for truthful retries/display
   - When a post has a prepared IG JPEG URL, update the Instagram row’s `image_url` to that `ig-ready/*.jpg` URL before publishing.
   - This makes manual retries use the verified URL and keeps the UI aligned with what was actually sent to Instagram.

4. Improve error handling and UI feedback
   - Do not return a huge repeated red error blob for every page when the single shared media URL fails preparation.
   - Return one clear media-preparation error before per-page publishing starts.
   - Keep per-page Meta errors only for real page/account-level failures after media preparation succeeds.

5. Regression coverage
   - Update the existing IG durable JPEG regression test to require:
     - no silent fallback to the original URL after failed materialization,
     - preparation happens before IG page fan-out,
     - manual and cron publish both use the shared prepared media path,
     - prepared `ig-ready/*.jpg` URL is persisted for retry/display.

6. Validation after implementation
   - Run targeted social publishing regression tests.
   - Check the failed row/recent logs to confirm future attempts no longer send the original PNG/proxy URL to Meta.
   - Deploy the updated edge functions after tests pass.