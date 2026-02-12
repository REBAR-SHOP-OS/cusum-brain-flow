

# Security Hardening Sprint — 5 Priorities

This plan implements the 5 security fixes identified in the audit, ordered by criticality.

---

## Priority 1: Lock Down `profiles.company_id` (Critical)

**Current state:**
- `protect_profile_company_id` trigger EXISTS and blocks non-admin updates -- GOOD
- `protect_profile_user_id` trigger EXISTS and blocks non-admin updates -- GOOD
- The "Users can update own profile" policy has NO column restriction -- users can attempt to SET company_id, but the trigger catches it

**Assessment: Already protected.** The trigger-based guard is solid. However, we should add a belt-and-suspenders RLS `WITH CHECK` to the user self-update policy.

**Changes:**
- Migration: Replace the "Users can update own profile" UPDATE policy with one that adds `WITH CHECK (company_id = OLD.company_id)` or restrict updatable columns via a view
- Since Postgres RLS doesn't support column-level restrictions natively, the trigger approach is the correct one. We will add an explicit WITH CHECK to the update policy to double-lock it.

---

## Priority 2: Remove Employee Self-Access to `employee_salaries` (High)

**Current state:**
- Admin-only SELECT/INSERT/UPDATE/DELETE policies exist -- GOOD
- BUT there is also a "Users can view own salary" policy that lets employees read their own row via `profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())` -- THIS IS THE RISK

**Changes:**
1. **Migration:** Drop the "Users can view own salary" RLS policy
2. **Migration:** Add `audit_salary_access` trigger to `employee_salaries` for SELECT auditing (the function exists but no trigger is attached)
3. No code changes needed -- `useSalaries()` already handles permission errors gracefully (returns `[]`)

---

## Priority 3: Make Public Storage Buckets Private + Signed URLs (High)

**Current state:**
- `shape-schematics` = PUBLIC (used for AI vision schematic uploads)
- `social-media-assets` = PUBLIC (used for generated social content)
- `social-images` = PUBLIC (used for AI-generated images)
- `avatars` = PUBLIC (profile photos)

**Assessment:**
- `avatars` can stay public (low risk, standard pattern)
- `shape-schematics` should go PRIVATE (proprietary fabrication data)
- `social-media-assets` and `social-images` must stay public because they are used as direct URLs in social media posts (Facebook, LinkedIn, TikTok publish flows require publicly accessible image URLs)

**Changes:**
1. **Migration:** Set `shape-schematics` bucket to `public = false`
2. **Code:** Update `AiVisionUploadDialog.tsx` and `useShapeSchematics` to use signed URLs instead of `getPublicUrl()`
3. **Code:** Create a `getSignedSchematicUrl()` utility similar to existing `getSignedFileUrl()`

---

## Priority 4: Add Input Validation to Critical Edge Functions (Medium)

**Current state:** 0 out of 40 edge functions that parse `req.json()` use Zod or any schema validation. All trust raw input.

**Approach:** Add Zod validation to the 10 most security-sensitive functions first (those that write to DB or call external APIs with user-supplied data):

| Function | Risk | Validation Needed |
|----------|------|-------------------|
| `convert-quote-to-order` | Financial | UUID for quoteId |
| `log-machine-run` | Production data | Full schema (machineRunId, process, status, quantities) |
| `manage-machine` | Equipment control | action enum + machineId UUID |
| `manage-inventory` | Asset management | action enum + item fields |
| `smart-dispatch` | Logistics | action enum + route fields |
| `gmail-send` | Email sending | to/subject/body validation |
| `social-publish` | External API | platform enum + content fields |
| `face-recognize` | Biometric | base64 format + companyId UUID |
| `handle-command` | NLP/AI | input string length cap |
| `generate-video` | Expensive API | action enum + prompt length cap |

**Changes per function:**
- Import Zod from esm.sh
- Define schema for request body
- Parse with `.safeParse()` before any logic
- Return 400 with validation errors on failure

---

## Priority 5: Narrow Contacts RLS + Verify Audit Logging (Medium)

**Current state:**
- Sales/accounting can read contacts if they have ANY communication or lead assignment -- broad
- `audit_contact_changes` trigger is attached for INSERT/UPDATE/DELETE -- fires on writes
- `contact_access_log` has 0 rows -- likely because no writes have occurred via the client, or SELECT reads are not logged (triggers can't fire on SELECT)

**Assessment:**
- The existing RLS is actually reasonable for a small team (5-12 people) -- it scopes to company_id AND requires a relational link
- The `contact_access_log` being empty is expected: Postgres triggers cannot fire on SELECT. The `log_contact_access()` function must be called explicitly from application code
- The real gap is that no code calls `log_contact_access()` on reads

**Changes:**
1. **Code:** Add `supabase.rpc('log_contact_bulk_access', { _count, _action: 'list_read' })` call in the contacts list hook when fetching contacts
2. **Code:** Add `supabase.rpc('log_contact_access', { _action: 'detail_read', _contact_id })` call when viewing a single contact
3. **Migration:** No RLS changes needed -- current policy is adequate for team size. Document the decision.

---

## Technical Implementation Sequence

```text
Step 1: Migration (all DB changes in one migration)
  +-- Drop "Users can view own salary" policy
  +-- Add WITH CHECK to profiles update policy
  +-- Set shape-schematics bucket to private

Step 2: Edge Functions (parallel, 10 functions)
  +-- Add Zod validation to each function
  +-- Deploy all at once

Step 3: Frontend Code Changes
  +-- Update shape-schematics to use signed URLs
  +-- Add contact access logging RPC calls
  +-- Update useSalaries() error message for employees
```

---

## What This Does NOT Change

- `social-media-assets` and `social-images` remain public (required for external platform publishing)
- `avatars` remain public (standard pattern, low-risk)
- Contacts RLS stays as-is (adequate for current team size)
- No new tables created (existing `contact_access_log`, `financial_access_log` are sufficient)

