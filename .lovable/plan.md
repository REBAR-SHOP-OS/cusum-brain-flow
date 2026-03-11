

## AI Video Generator — Audit Report

### Architecture Overview
The system has 3 layers: **CreateContentDialog** (menu) → **VideoGeneratorDialog** (UI) → **generate-video** edge function (backend proxy to Veo/Sora APIs).

---

### Issues & Bottlenecks Found

#### 1. CRITICAL: Veo Download Never Triggered from Client
The client checks `data.needsAuth` (line 140) for Sora downloads but the Veo poll response returns `needsGeminiAuth: true` (edge function line 97), **not** `needsAuth`. So when Veo completes, the client tries to use the raw `videoUrl` directly — which is a Google API URI requiring auth headers. **The video will fail to load/play.**

**Fix**: Client should also check `data.needsGeminiAuth` and proxy the download for Veo videos too.

#### 2. CRITICAL: Sora Download Uses Wrong Auth Token
In `VideoGeneratorDialog.tsx` line 149, the Sora download proxy uses `VITE_SUPABASE_PUBLISHABLE_KEY` as the Bearer token instead of the user's session token. The edge function's `verifyAuth` validates against auth tokens, so this request will return **401 Unauthorized**.

**Fix**: Use `supabase.auth.getSession()` to get the real access token for the download fetch.

#### 3. HIGH: Model Name Mismatch — Veo 3 vs Veo 3.1
The UI says "Google Veo 3" but the edge function uses model `veo-3.1-generate-preview`. The UI model ID is `veo-3` which doesn't match anything on the backend — this is cosmetic but confusing.

#### 4. HIGH: Duration Mismatch Between Client and Server
- Client offers Veo durations: **5s, 8s** (line 41-42)
- Server accepts Veo durations: **4, 6, 8** (line 37)
- Duration "5" from client gets snapped to "4" or "6" on server — user expects 5s but gets something else with no feedback.

#### 5. MEDIUM: No Polling Timeout / Max Retries
`pollForResult` polls every 5s indefinitely. If the API hangs or returns `processing` forever, the user is stuck with a spinner and no way to cancel. There's no max poll count or timeout.

**Fix**: Add a max poll count (e.g., 60 polls = 5 minutes) and auto-fail with a timeout message.

#### 6. MEDIUM: `supabase.functions.invoke` Swallows Error Bodies
The project has `invokeEdgeFunction.ts` specifically to avoid this SDK limitation, but the video generator still uses `supabase.functions.invoke()`. Error messages from the edge function may not surface correctly.

**Fix**: Use `invokeEdgeFunction` instead.

#### 7. LOW: No Rate Limiting or Abuse Prevention
Any authenticated user can trigger unlimited video generations. No per-user throttling or daily caps.

#### 8. LOW: Blob URL Memory Leak
When Sora video is downloaded as blob (line 159), `URL.createObjectURL()` is called but `URL.revokeObjectURL()` is never called on cleanup, leaking memory.

#### 9. LOW: OpenAI Quota Already Exhausted
Edge function logs from `social-intelligence` show `insufficient_quota` errors for the GPT API key. Sora (which uses the same `GPT_API_KEY`) will likely fail with the same quota issue.

---

### Proposed Fixes (Priority Order)

| # | Fix | File |
|---|-----|------|
| 1 | Handle `needsGeminiAuth` in client — proxy Veo downloads through edge function | `VideoGeneratorDialog.tsx` |
| 2 | Use session token (not anon key) for download proxy auth | `VideoGeneratorDialog.tsx` |
| 3 | Switch from `supabase.functions.invoke` to `invokeEdgeFunction` | `VideoGeneratorDialog.tsx` |
| 4 | Add max poll count (60) with timeout error | `VideoGeneratorDialog.tsx` |
| 5 | Align duration options: client should offer 4/6/8 for Veo | `VideoGeneratorDialog.tsx` |
| 6 | Revoke blob URLs on cleanup | `VideoGeneratorDialog.tsx` |
| 7 | Update UI label to "Google Veo 3.1" | `VideoGeneratorDialog.tsx` |

Most fixes are in `VideoGeneratorDialog.tsx`. The edge function logic is sound — the bottlenecks are all on the client side.

