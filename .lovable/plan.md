

# Fix Agents v2: All Bugs, Security Gaps, and Hardening

This plan addresses every issue the user identified plus additional problems found during audit.

---

## Confirmed Bugs

### 1. Suggestions RLS: No Company Scoping on SELECT
**The `suggestions` SELECT policy is `qual: true`** -- any authenticated user can read ALL suggestions across ALL companies. This is a **data leak**.

**Fix:** Replace with `company_id = get_user_company_id(auth.uid())::text` (note: `company_id` is TEXT, `get_user_company_id` returns UUID, so cast needed).

### 2. Suggestions RLS: UPDATE Policy Wrong
Current UPDATE policy: `shown_to = auth.uid() OR shown_to IS NULL`. This allows any user to update ANY suggestion where `shown_to` is null (which is all agent-generated ones). Users could dismiss/snooze suggestions across companies.

**Fix:** Add `company_id = get_user_company_id(auth.uid())::text` to the UPDATE qual.

### 3. Query Key Missing `agentCode` (Cache Collision)
In `useAgentSuggestions.ts` line 28: `queryKey: ["agent-suggestions", agentCode]` -- this is correct in the current code. However, the `onSuccess` invalidation on lines 81, 91, 102 uses `queryKey: ["agent-suggestions"]` without `agentCode`, which means mutations invalidate ALL agent suggestion queries (Vizzy + Penny + Forge). This causes unnecessary refetches but isn't a data bug. Minor fix for efficiency.

### 4. `generate-suggestions` Edge Function: No Auth, No Admin Check
The function uses `SUPABASE_SERVICE_ROLE_KEY` and has no authentication check. Anyone who knows the URL can trigger suggestion generation. It's also missing from `config.toml` (no `verify_jwt = false` entry).

**Fix:** Add to `config.toml`, add auth check requiring admin role, OR at minimum rate-limit.

### 5. `generate-suggestions`: No Dedup Index
Dedup relies on an in-memory Set checked against currently open suggestions. If two concurrent calls happen, both insert duplicates. There's no unique constraint on `(entity_type, entity_id, category, status)`.

**Fix:** Add a partial unique index on `suggestions(entity_type, entity_id, category)` where `status IN ('open','new')`.

### 6. `generate-suggestions`: `actions` Stored as JSON String, Not JSONB
The edge function does `JSON.stringify([...])` for the `actions` field, but the column is JSONB. This means it's stored as a JSON string inside JSONB (double-encoded). The client then reads it and tries to cast directly, which may fail or produce a string instead of an array.

**Fix:** Remove `JSON.stringify()` wrapper -- pass the array directly and let Supabase handle JSONB serialization.

### 7. `AgentSuggestionCard`: `borderLeftColor` CSS Hack Broken
Line 38: `config.color.replace("text-", "var(--")` produces strings like `var(--destructive` (missing closing paren) and won't work as CSS. The border-left color is silently broken.

**Fix:** Use a proper color map instead of string manipulation.

---

## Security Fixes

### 8. Voice Token: Company Scope Missing
`elevenlabs-conversation-token` checks `voice_enabled` and admin role but doesn't verify company scope. In a multi-tenant setup, a user from company B with `voice_enabled=true` gets the same agent signed URL as company A's CEO.

**Fix:** This is acceptable for now since there's a single ElevenLabs agent, but document it.

### 9. `agent_action_log` INSERT: No Server-Side Validation
The client inserts `action_type`, `entity_type`, `entity_id` with no validation. A malicious user could insert arbitrary audit records. The RLS ensures `user_id = auth.uid()` and correct `company_id`, so they can only log actions as themselves, which is acceptable for audit purposes.

**Status:** Low risk, no change needed.

---

## Implementation Steps

### Step 1: Database Migration
- Drop and recreate `suggestions` SELECT policy with company scoping
- Fix `suggestions` UPDATE policy with company scoping  
- Add partial unique index for dedup: `CREATE UNIQUE INDEX ON suggestions(entity_type, entity_id, category) WHERE status IN ('open','new') AND entity_type IS NOT NULL`
- Add `generate-suggestions` to `config.toml`

### Step 2: Fix `generate-suggestions` Edge Function
- Add auth guard (require admin role)
- Remove `JSON.stringify()` from `actions` field (pass raw arrays)

### Step 3: Fix `useAgentSuggestions.ts`
- Fix invalidation keys to include `agentCode`

### Step 4: Fix `AgentSuggestionCard.tsx`
- Replace broken CSS color hack with a proper color mapping

---

## Technical Details

### Files to Modify
- `supabase/functions/generate-suggestions/index.ts` -- auth guard + fix JSON.stringify
- `src/hooks/useAgentSuggestions.ts` -- fix invalidation query keys
- `src/components/agent/AgentSuggestionCard.tsx` -- fix border color
- `supabase/config.toml` -- add generate-suggestions entry (auto-managed, just noting)

### Database Migration SQL (Summary)
```text
-- Fix SELECT policy: company-scoped
DROP POLICY "Authenticated users can read suggestions" ON suggestions;
CREATE POLICY "Users read own company suggestions" ON suggestions
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- Fix UPDATE policy: company-scoped  
DROP POLICY "Authenticated users can update own shown suggestions" ON suggestions;
CREATE POLICY "Users update own company suggestions" ON suggestions
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

-- Dedup index
CREATE UNIQUE INDEX IF NOT EXISTS idx_suggestions_dedup
  ON suggestions(entity_type, entity_id, category)
  WHERE status IN ('open','new') AND entity_type IS NOT NULL;
```

### Color Fix Map
Replace string manipulation with:
```text
critical -> border-red-500
warning  -> border-amber-500  
info     -> border-blue-500
```
Using Tailwind classes directly via className instead of inline style.
