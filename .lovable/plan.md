## Problem

Downloading attachments from Team Hub fails with `ERR_BLOCKED_BY_CLIENT`. This is **not** a server/RLS issue — the request never leaves the browser. An installed extension (uBlock / AdGuard / Brave Shields / privacy filter) is matching the URL pattern `*.supabase.co/storage/v1/object/sign/*` and blocking it.

Today `downloadFile()` in `src/lib/downloadUtils.ts` detects Supabase URLs and triggers a plain `<a href={signedUrl} download>` click. The browser then issues a top-level navigation to the blocked URL → Chrome shows the "page is blocked" screen the user just saw.

## Fix

Stop relying on the raw signed URL for Supabase storage downloads. Instead use the Supabase JS client's `storage.from(bucket).download(path)` call, which:

- Goes to `/storage/v1/object/authenticated/<bucket>/<path>` (different URL pattern, not on standard ad-block lists)
- Uses XHR with the auth header — the response is a `Blob` we trigger via object URL
- Same RLS, same bucket, no new permissions needed

### Changes

**1. `src/lib/chatFileUtils.ts`** — already has `extractChatFilePath()` (currently private). Export it so the downloader can recover the storage path from any legacy public/signed `team-chat-files` URL.

**2. `src/lib/downloadUtils.ts`** — in the existing Supabase-URL branch:
   - If the URL is a `team-chat-files` URL, parse out the path and call `supabase.storage.from('team-chat-files').download(path)`, then trigger a blob download.
   - On failure (network error, not RLS), fall back to the existing anchor download so non-blocked users still work.
   - Keep behaviour identical for non-storage URLs.

**3. No DB / RLS / edge-function changes.** The user is already authenticated and already passes the bucket's RLS — the signed URL works for users without the extension; we're just switching the transport.

### Out of scope

- We will not add a server-side proxy edge function (overkill; would also live on `*.supabase.co` and could still be filtered).
- We will not touch upload code, message rendering, or the bucket itself.
- Image previews inside messages still use signed URLs; if those are also blocked for some users we can extend the same pattern in a follow-up.

### Validation

- Click download on a chat attachment with the blocking extension active → file downloads as a blob.
- Click download with no extension → still works (blob path succeeds first; anchor fallback never runs).
- Voice notes / images / generic files all use the same `downloadFile()`, so all three are fixed by the single change.
