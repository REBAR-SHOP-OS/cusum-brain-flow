# Plan: Add Meta Platforms Developer Docs skill

Create a new draft skill at `.agents/skills/meta-platforms-docs/SKILL.md` (following the same shape as the existing `google-search-docs` skill) and apply it via `skills--apply_draft`.

## Skill scope (Full Meta platforms overview)

Single SKILL.md file with curated links — no copied content (docs change frequently; use `code--fetch_website` on demand).

Sections:

1. **Graph API** — overview, versioning, access tokens, debug tool, rate limits
   - https://developers.facebook.com/docs/graph-api/overview
   - https://developers.facebook.com/docs/graph-api/guides/versioning
   - https://developers.facebook.com/docs/facebook-login/guides/access-tokens

2. **Facebook Pages / Publishing** (relevant to Social Manager in this project)
   - https://developers.facebook.com/docs/pages-api
   - https://developers.facebook.com/docs/pages-api/posts
   - Page access tokens, required permissions (`pages_manage_posts`, `pages_read_engagement`, `pages_show_list`)

3. **Instagram Graph API** (Business/Creator account publishing)
   - https://developers.facebook.com/docs/instagram-platform
   - https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
   - Container → publish two-step flow, image/video/reels/carousel

4. **Marketing API** (ads)
   - https://developers.facebook.com/docs/marketing-apis

5. **Messenger Platform**
   - https://developers.facebook.com/docs/messenger-platform

6. **Webhooks**
   - https://developers.facebook.com/docs/graph-api/webhooks
   - Verification handshake, X-Hub-Signature-256 HMAC verification

7. **Login / Permissions / App Review**
   - https://developers.facebook.com/docs/facebook-login
   - https://developers.facebook.com/docs/permissions
   - https://developers.facebook.com/docs/app-review

8. **Usage rules** specific to this project:
   - Always use latest stable Graph API version pinned in code (don't rely on default)
   - Page tokens for Pages, IG User tokens (via linked Page) for Instagram
   - Verify webhook signatures with HMAC-SHA256 (matches project's webhook security memory)
   - Respect Neel approval gate before publishing (HARD rule)
   - Per-platform text sanitization already in `socialConstants.ts`
   - Fetch live doc pages with `code--fetch_website` when quoting — Meta updates often

## Trigger description (frontmatter)

> Reference for Facebook/Meta developer platforms — Graph API, Pages publishing, Instagram Graph API, Marketing API, Messenger, Webhooks, Login, and App Review. Use when working on Social Manager, Facebook/Instagram integrations, ads, messenger flows, or webhook handlers from Meta.

## Files to create

- `.agents/skills/meta-platforms-docs/SKILL.md` (single file, ~150 lines)

## Apply

Call `skills--apply_draft` with `.agents/skills/meta-platforms-docs`.

## Naming

Using `meta-platforms-docs` (covers FB + IG + Messenger + Marketing under the Meta umbrella). If you'd prefer `facebook-graph-api` (narrower) or another name, tell me before I implement.
