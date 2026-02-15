

## Knowledge Book: Production Lessons Learned

Create a comprehensive internal reference document at `docs/KNOWLEDGE_BOOK.md` capturing every hard-won lesson from building Vizzy Web. This will serve as a quick-reference for future development.

### Document Structure

**1. Mobile Audio Playback (iOS Safari + Chrome)**
- Problem: iOS kills `.play()` if any `await` sits between the user tap and the play call
- Solution: "Prime and Replay" -- synchronously call `.play()` with a silent WAV data URI during the gesture, then swap `src` after async work
- AudioContext gets suspended on tab switch / screen lock -- must listen for `statechange` and re-arm unlock listeners
- Never use `{ once: true }` on unlock listeners; keep retrying until `audioCtx.state === "running"` is confirmed
- Pre-cache decoded AudioBuffers at unlock time so notification sounds play instantly

**2. Auth Session Resilience**
- Stale/corrupt tokens in localStorage cause infinite `bad_jwt` polling loops
- Fix: catch `getSession()` errors and call `signOut({ scope: 'local' })` to clear storage
- Handle `TOKEN_REFRESHED` event with null session the same way
- Always set up `onAuthStateChange` listener before calling `getSession()` to avoid race conditions

**3. Realtime Subscriptions**
- Always filter by `user_id` in the subscription filter to avoid processing other users' events
- Clean up channels in `useEffect` return to prevent memory leaks
- Handle INSERT/UPDATE/DELETE separately; dismissed items should be filtered out of state on UPDATE

**4. Notification System Architecture**
- Permission prompt: only ask once per device (use localStorage flag), never re-prompt if denied
- Push registration: skip if permission not granted; set `pushRegistered = false` on failure to allow retry
- Sound: thin wrapper (`notificationSound.ts`) calls into the shared `audioPlayer.ts`; keeps notification logic decoupled from audio mechanics

**5. Error Handling and Auto-Reporting**
- `useGlobalErrorHandler`: catches unhandled rejections and uncaught errors globally
- Ignore noise: ResizeObserver loops, chunk loading failures, AbortErrors, permission denials
- Auto-escalation: if the same error fires 3+ times in a session, report it to a fix-request queue
- Deduplication: use `sessionStorage` with a 5-minute cooldown key to avoid spamming reports
- Error log: persist last 50 errors in `localStorage` for on-device diagnostics

**6. Knowledge Base / RAG Import**
- Bulk paste: split on `\n---\n`, first line becomes title, rest becomes content
- URL scrape: use `firecrawl-scrape` edge function to convert pages to markdown
- Always generate slugs from titles; set `is_published: true` by default for imported content

**7. Edge Function Patterns**
- Over 100 edge functions in production -- keep each focused on a single responsibility
- Shared utilities go in `supabase/functions/_shared/`
- Secrets are managed via Lovable Cloud; never hardcode API keys

**8. Storage and Signed URLs**
- Use `createSignedUrl()` with a 1-hour expiry for file access
- Always handle the error case gracefully (return empty string, let caller decide)

**9. General React Patterns**
- Use `useCallback` for all functions passed to child components or used in dependency arrays
- Optimistic UI updates: apply state change immediately, revert on API error
- `useCompanyId` hook centralizes workspace context; always check for null before writes

**10. Common Gotchas**
- Supabase default query limit is 1000 rows -- paginate or increase limit when debugging "missing data"
- Never edit auto-generated files: `client.ts`, `types.ts`, `config.toml`, `.env`
- `as any` casts on table names indicate the table exists but isn't in the generated types yet -- acceptable during rapid iteration but should be cleaned up

### File to Create
- `docs/KNOWLEDGE_BOOK.md` -- single markdown file with all sections above, code snippets for each pattern, and a table of contents for quick navigation

