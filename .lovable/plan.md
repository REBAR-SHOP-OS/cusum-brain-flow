
Goal: audit the failure path for the Office extraction and identify the root cause from logs, then outline the exact fix.

What I confirmed from the logs:
- The browser successfully created:
  - the session `e4280e6a-2674-4c03-bf49-4531b3ac71ac`
  - the related raw file record
- The browser then called the backend function `extract-manifest`
- That request failed at the network layer with `Failed to fetch`
- UI logs then showed:
  - `fetched 0 rows`
  - `retry fetched 0 rows`
- The session remained stuck in `extracting` with `progress: 0`

Root cause from backend logs:
- The backend function did not actually run for that failed request because it crashed during boot
- Exact failure:
  `Uncaught SyntaxError: The requested module 'https://deno.land/std@0.190.0/encoding/base64.ts' does not provide an export named 'encodeBase64'`
- This is happening in:
  `supabase/functions/extract-manifest/index.ts`
- Because the worker crashes before request handling, the frontend only sees `Failed to fetch`

Important conclusion:
- This specific failure is not caused by the uploaded `.xls` content
- It is a backend boot/import failure
- Later logs show the same function booting and parsing a spreadsheet successfully for a newer session, which means the issue is tied to the deployed function version / cold-started broken worker, not the file itself

Implementation plan:
1. Fix the broken import in `supabase/functions/extract-manifest/index.ts`
   - remove the invalid `encodeBase64` import
   - replace it with a runtime-safe local base64 helper for `Uint8Array`
2. Redeploy the extraction function
   - verify the function boots cleanly with no worker boot error
3. Harden failure handling
   - ensure extraction boot/runtime failures write `status: "error"` and `error_message` to the session instead of leaving it stuck on `extracting`
4. Improve UI resilience in `AIExtractView.tsx`
   - detect “stuck extracting + zero rows + function failure” and show the real backend error instead of indefinite extracting state
5. Re-run validation on the same upload flow
   - create session
   - upload `.xls`
   - call extraction
   - confirm session advances past `extracting`
   - confirm rows are inserted
   - confirm the UI no longer shows empty row state for this case

Technical notes:
- Broken file: `supabase/functions/extract-manifest/index.ts`
- Symptom path:
  `invalid edge import -> worker boot crash -> browser gets Failed to fetch -> session stuck extracting -> rows query returns 0`
- Secondary hardening needed:
  current client flow assumes request failures are standard application errors, but a boot crash never returns a normal JSON error body

Expected outcome after implementation:
- No more silent `Failed to fetch` for this extraction path
- Failed backend boots become visible, recoverable errors
- Sessions do not remain stuck in `extracting`
- The same `.xls` upload path proceeds normally once the function is redeployed with the fixed import
