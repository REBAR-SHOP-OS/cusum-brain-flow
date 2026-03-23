

## Audit: Why Vizzy Can't Read Employee Emails

### Root Cause

Vizzy has **no tool or action to read email content on-demand**. Here's what exists vs what's missing:

**What exists:**
- `vizzyFullContext.ts` pre-loads today's emails from `communications` table with `body_preview` (truncated to 200 chars) and `subject` — this is injected into the system prompt as static context
- `vizzy-erp-action` has a `send_email` action but **no `read_emails` or `get_email_details` action**
- The `communications` table stores `body_preview` (short snippet) but full email bodies are only in Gmail API (not stored locally)

**Why Vizzy fabricates answers:**
1. Vizzy sees aggregated stats in its context (e.g., "Vicky Anderson: 8 sent, 10 received") and up to 8 email subject lines with 200-char previews
2. When asked to "read the actual emails," Vizzy has no tool to fetch full email bodies — it can only see the pre-loaded snippets
3. Without a tool, the LLM hallucinates plausible-sounding summaries instead of saying "I can't access full email content"

### Fix: Add `read_employee_emails` ERP Action

**File**: `supabase/functions/vizzy-erp-action/index.ts`

Add a new `case "read_employee_emails"` that:
1. Accepts `{ employee_name_or_email: string, limit?: number, date?: string }`
2. Resolves the employee to their `user_id` via profiles
3. Queries `communications` table for that user's emails (both directions) with full `body_preview`, `subject`, `from_address`, `to_address`, `direction`, `received_at`
4. Optionally fetches full email body from Gmail API via `gmail-sync` for specific message IDs
5. Returns structured email list

**File**: `supabase/functions/_shared/agents/operations.ts`

Update Vizzy's system prompt to include the new tool in her available actions list, so she knows to call `read_employee_emails` instead of guessing.

**File**: `supabase/functions/_shared/vizzyFullContext.ts`

Increase `body_preview` slice from 200 chars to 500 chars in the per-employee email detail section (line 668) to give more context in the pre-loaded data.

### Optional Enhancement: Full Email Body Fetch

The `communications` table only stores `body_preview` (truncated). For full email reading:

Add a `read_email_thread` action that:
1. Takes a `thread_id` or `communication_id`
2. Calls Gmail API (via the user's stored OAuth token) to fetch the full message body
3. Returns the complete email content

This requires the Gmail OAuth token lookup pattern already used in `gmail-sync`.

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/vizzy-erp-action/index.ts` | Add `read_employee_emails` + `read_email_thread` actions | Safe additive |
| `supabase/functions/_shared/agents/operations.ts` | Add tool documentation to Vizzy's prompt | Safe additive |
| `supabase/functions/_shared/vizzyFullContext.ts` | Increase preview length to 500 chars | Safe edit |

### Why This Fixes the Problem

- Vizzy will have an explicit tool to query any employee's emails with full previews
- The LLM will call the tool instead of hallucinating
- For deep reading, the thread reader fetches full bodies from Gmail
- No schema changes needed — uses existing `communications` table + Gmail API

