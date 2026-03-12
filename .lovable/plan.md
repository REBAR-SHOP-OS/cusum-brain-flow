
Goal: update the Wan provider key used by video generation and confirm it’s accepted.

What I verified in code:
- `generate-video` reads `DASHSCOPE_API_KEY` from backend secrets.
- Wan requests go to the International endpoint (`dashscope-intl.aliyuncs.com`) with `Authorization: Bearer <key>`.
- The secret name already exists in your project (`DASHSCOPE_API_KEY`), so this is an update, not a new integration.

Plan:
1. Update the existing secret `DASHSCOPE_API_KEY` in Lovable Cloud (you’ll paste the new key value).
2. Redeploy the `generate-video` backend function so the updated secret is active.
3. Run a direct confirmation request to `generate-video` with a minimal Wan payload.
4. Validate success criteria:
   - No `"Invalid API-key provided"` error
   - Function returns a task/job response for Wan generation.
5. If it still fails, check backend function logs immediately and classify root cause as either:
   - key format/source issue, or
   - account/service entitlement issue.

Technical details:
- Secret to update: `DASHSCOPE_API_KEY`
- Function to redeploy: `generate-video`
- Confirmation payload: `provider: "wan"`, `model: "wan2.1-t2v-plus"`, short prompt, 4s duration
- Expected outcome: accepted async task creation response (not 401 invalid key)
