---
name: meta-platforms-docs
description: Reference for Facebook/Meta developer platforms — Graph API, Pages publishing, Instagram Graph API, Marketing API, Messenger, Webhooks, Login, and App Review. Use when working on Social Manager, Facebook/Instagram integrations, ads, messenger flows, or webhook handlers from Meta.
---

# Meta Platforms Developer Reference

Source portal: https://developers.facebook.com/docs/

Use this skill whenever code or directives touch Facebook, Instagram, Messenger, Meta Marketing, or any Graph API surface. Fetch live docs on demand with `code--fetch_website` — Meta updates them frequently and pins versions quarterly.

## Core sections (fetch on demand)

### Graph API fundamentals
- Overview: https://developers.facebook.com/docs/graph-api/overview
- Versioning & changelog: https://developers.facebook.com/docs/graph-api/guides/versioning
- Access tokens: https://developers.facebook.com/docs/facebook-login/guides/access-tokens
- Debug token tool: https://developers.facebook.com/tools/debug/accesstoken/
- Rate limiting: https://developers.facebook.com/docs/graph-api/overview/rate-limiting
- Error codes: https://developers.facebook.com/docs/graph-api/guides/error-handling

### Facebook Pages / Publishing
- Pages API: https://developers.facebook.com/docs/pages-api
- Page posts: https://developers.facebook.com/docs/pages-api/posts
- Photos & videos: https://developers.facebook.com/docs/pages-api/photos, https://developers.facebook.com/docs/pages-api/videos
- Required permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_metadata`
- Page access tokens are obtained by exchanging a user token via `GET /me/accounts`

### Instagram Graph API (Business / Creator accounts)
- Platform overview: https://developers.facebook.com/docs/instagram-platform
- Content publishing: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- Publishing flow is two-step: `POST /{ig-user-id}/media` (creates container) → `POST /{ig-user-id}/media_publish` with returned creation_id
- Supports: image, video, reels, carousel (max 10 items), stories (limited)
- Account must be Business/Creator and linked to a Facebook Page

### Marketing API (Ads)
- Overview: https://developers.facebook.com/docs/marketing-apis
- Campaign structure: Campaign → AdSet → Ad → Creative
- Insights: https://developers.facebook.com/docs/marketing-api/insights

### Messenger Platform
- Overview: https://developers.facebook.com/docs/messenger-platform
- Send API, message tags, 24-hour messaging window, handover protocol

### Webhooks
- Setup: https://developers.facebook.com/docs/graph-api/webhooks
- Verification handshake (GET with `hub.mode`, `hub.verify_token`, `hub.challenge`) — echo challenge as plaintext
- Payload verification: `X-Hub-Signature-256` header = `sha256=` + HMAC-SHA256(payload, app_secret)
- Subscribe per object: `page`, `instagram`, `user`, `permissions`

### Login / Permissions / App Review
- Facebook Login: https://developers.facebook.com/docs/facebook-login
- Permissions reference: https://developers.facebook.com/docs/permissions
- App Review (required for non-basic permissions): https://developers.facebook.com/docs/app-review
- Business Verification required for advanced page/instagram/marketing permissions

## Usage rules for this project

1. **Pin Graph API version** in code (e.g. `v21.0`). Never rely on the default — Meta deprecates versions on a 2-year cycle.
2. **Token hierarchy:** user token → page token (`/me/accounts`) → IG user token (via linked Page's `instagram_business_account` field). Never call Page or IG endpoints with a raw user token.
3. **Webhook signature verification is mandatory.** Use `X-Hub-Signature-256` HMAC-SHA256 with the app secret, constant-time compare. Matches the project's webhook security standard.
4. **Neel Approval Gate (HARD):** Social posts may only call publish endpoints when `neel_approved = true`. No admin/email bypass on manual or cron path.
5. **Per-platform sanitization:** Use existing helpers in `src/lib/socialConstants.ts` for caption/hashtag limits — do not hand-roll new sanitizers.
6. **Long-lived tokens:** Always exchange short-lived tokens for long-lived ones (~60d) immediately after OAuth; store encrypted.
7. **Rate limit headers:** Honor `X-App-Usage` and `X-Business-Use-Case-Usage` — back off when call_count or total_time approaches 100.
8. **App secret proof:** For server-to-server calls, include `appsecret_proof = HMAC-SHA256(access_token, app_secret)` for hardening.
9. **Fetch live docs** with `code--fetch_website` before quoting field names, required parameters, or error codes — Meta changes them often.
