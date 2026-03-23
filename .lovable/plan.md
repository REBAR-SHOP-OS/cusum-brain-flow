

## Audit: 4 Critical Bugs Found in Text Vizzy

### Bug 1: `companyId is not defined` — investigate_entity crashes

**Root cause**: `executeReadTool()` (line 781) is a standalone function that receives `(supabase, toolName, args)` — but `investigate_entity` (line 1647), `deep_business_scan` (line 1310+), and `auto_diagnose_fix` all reference `companyId` as if it's in scope. It's NOT. `companyId` is defined at line 2402 inside the `Deno.serve` handler closure, but `executeReadTool` is defined outside that closure.

This means every time Vizzy calls `investigate_entity`, it throws `ReferenceError: companyId is not defined` and returns a generic error. This is why Vizzy falls back to stale context data.

**Fix**: Add `companyId` as a 4th parameter to `executeReadTool`:
- Function signature: `executeReadTool(supabase, toolName, args, companyId)`
- Call site (line 2792): `executeReadTool(supabase, tc.function.name, args, companyId)`

---

### Bug 2: Vizzy responds in Farsi when user's preferred language is English

**Root cause**: Line 2460-2464 says:
> "You are MULTILINGUAL. You MUST respond in whatever language the CEO speaks to you."

The user typed "hi employee performance" in English, but Vizzy responded entirely in Farsi. This happens because the pre-digest context or previous messages contain Farsi, and the model picks up on that. There's no hard rule that says "DEFAULT to English" or checks the user's `preferred_language` profile setting.

**Fix**: Change the LANGUAGE section to:
- "Your DEFAULT language is English. Always respond in English unless the CEO explicitly writes to you in another language."
- "If the CEO writes in Farsi, respond in Farsi. If they switch back to English, switch back immediately."
- Remove "You are MULTILINGUAL" opener which biases the model toward switching languages

---

### Bug 3: `send_email` fails — auth mismatch with gmail-send

**Root cause**: `send_email` in `executeWriteTool` calls `gmail-send` with `Authorization: Bearer ${serviceKey}` (service_role key). But `gmail-send`'s `verifyAuth()` creates a Supabase client with the anon key and calls `supabase.auth.getUser()` — which returns null for service_role tokens (service_role is not a user JWT). So `gmail-send` returns 401, and Vizzy says "I can't send emails."

**Fix**: Pass the original user's JWT to `gmail-send` instead of the service_role key. The user's auth token is available from the original request's Authorization header. Add it to the `executeWriteTool` parameters and forward it to `gmail-send`.

---

### Bug 4: Banned phrases still appearing

Vizzy still says: "I can do a deeper investigation... Just let me know who to focus on." — this violates the BANNED PHRASES rule. The banned list covers specific phrases but not the pattern of offering help generically. 

**Fix**: Add to banned phrases: "Just let me know" and "If you need more detail" — both are reactive, not proactive.

---

### Implementation Summary

| File | Changes |
|---|---|
| `supabase/functions/admin-chat/index.ts` | 1) Add `companyId` param to `executeReadTool` signature + call site. 2) Fix LANGUAGE section to default English. 3) Pass user JWT to `send_email` → `gmail-send`. 4) Add more banned phrases. |

### What is NOT changed
- No schema changes
- No new edge functions
- `gmail-send` unchanged (it already handles user JWTs correctly)
- Voice engine unchanged

