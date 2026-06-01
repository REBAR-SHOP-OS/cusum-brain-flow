## Goal
Make every image generated from the Story icon/request path a true 9:16 vertical story image, not square. The fix will prioritize instructing the image model itself with an explicit 9:16 requirement and prevent square output settings from being sent.

## Plan
1. **Strengthen the LLM prompt for Story generation**
   - Update the Story prompt sent to the image model so the first instruction is an explicit hard contract:
     - output must be vertical portrait
     - exact story aspect ratio 9:16
     - target dimensions 1080×1920 or equivalent 9:16
     - square 1:1 output is forbidden
   - Apply this to the manual Story icon flow and the automated story generation flow.

2. **Fix the actual model request dimensions**
   - Replace the current 2:3-ish request size (`1024x1536`) in Story image calls with a real 9:16-compatible size where the model/API supports it, such as `1024x1792`.
   - Ensure no Story path sends `1024x1024`.

3. **Keep server-side enforcement as the safety net**
   - Keep the existing strict server crop/validation so even if the model returns the wrong shape, the stored/displayed result is forced to 9:16 or rejected.
   - Update the resize target so strict 9:16 output is stored as a true 9:16 portrait size, not 2:3.

4. **Fix display paths that visually make stories look square**
   - Adjust the story preview/zoom/card rendering so Story posts use a portrait `aspect-[9/16]` container instead of square `aspect-square` where applicable.
   - This avoids a correct 9:16 image being displayed inside a square crop.

5. **Regression coverage**
   - Update the existing regression test to assert:
     - Story prompts contain mandatory 9:16 wording.
     - Story request size is 9:16-compatible.
     - Story UI passes `aspectRatio: "9:16"`.
     - Story display paths do not force story images into square presentation.

## Validation
- Run the targeted regression test for story images.
- Verify the relevant source now contains no square request size in Story paths and that Story UI displays portrait images.