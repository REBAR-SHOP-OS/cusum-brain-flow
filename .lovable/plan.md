

# App Builder (Architect) -- Screenshot-to-Fix Engine + Secure Platform Diagnostics

## Summary

Upgrade the App Builder (/empire) module with a structured "Screenshot to Fix" ticket system, enhanced diagnostic tools, verification enforcement, and secure read-only connections to QuickBooks/Odoo/ERP. All changes are confined to the App Builder module only.

---

## Part 1: Database -- New `fix_tickets` Table

Create a new `fix_tickets` table to store structured fix requests with full lifecycle tracking (replacing the simple `vizzy_fix_requests` for App Builder use cases).

**Columns:**
- `id` UUID PK
- `company_id` UUID (FK to companies)
- `reporter_user_id` UUID (auth user who reported)
- `reporter_email` TEXT
- `page_url` TEXT
- `screenshot_url` TEXT (link to uploaded screenshot in storage)
- `repro_steps` TEXT
- `expected_result` TEXT
- `actual_result` TEXT
- `severity` TEXT (low / medium / high / critical) -- validated via trigger
- `system_area` TEXT (chat / accounting / inbox / shopfloor / etc.)
- `status` TEXT (new / in_progress / fixed / blocked / verified / failed) -- validated via trigger
- `fix_output` TEXT (code diff or Lovable prompt)
- `fix_output_type` TEXT (code_fix / lovable_prompt)
- `verification_steps` TEXT
- `verification_result` TEXT (pass / fail)
- `verification_evidence` TEXT
- `diagnosed_at` TIMESTAMPTZ
- `fixed_at` TIMESTAMPTZ
- `verified_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

**RLS:** Admins can CRUD; reporters can read their own tickets.

---

## Part 2: Edge Function Changes (ai-agent/index.ts -- empire section only)

### 2A: New Tool -- `create_fix_ticket`

Add a new tool definition for the empire agent that creates a structured fix ticket with all required fields (severity, system_area, repro_steps, expected/actual results).

### 2B: New Tool -- `update_fix_ticket`

Allow the Architect to update ticket status, add fix_output, verification_steps, verification_result. Enforce that status cannot go to "fixed" without verification_result = "pass".

### 2C: New Tool -- `list_fix_tickets`

List open/in-progress fix tickets for context.

### 2D: New Tool -- `diagnose_from_screenshot`

When the empire agent receives an attached screenshot:
1. Run OCR/vision analysis (already supported)
2. Auto-populate a fix_ticket draft with detected error info
3. Cross-reference with ERP logs, accounting sync status, and chat refresh triggers
4. Return structured diagnosis

### 2E: Enhanced `diagnose_platform` -- Network Trace + Refresh Coupling Detection

Add to the existing ERP diagnostics section:
- Check `activity_events` for recent errors matching the reported page/area
- Check if chat refresh and QB refresh are coupled (by inspecting recent timestamp patterns)
- Include results in diagnostic output

### 2F: System Prompt Enhancement

Update the empire agent system prompt to include:
- Fix ticket lifecycle instructions (never mark "fixed" without verification)
- Structured output format for fix requests
- "Lovable Fix Prompt" template generation capability
- Security rules: never expose secrets, read-only by default for QB/Odoo

### 2G: Secure Data Access Rules (already mostly in place)

The existing `diagnose_platform` handler already uses `svcClient` (service role) server-side. Confirm and enforce:
- QuickBooks data: read-only from `accounting_mirror` table (no direct QB API writes from Architect)
- Odoo data: read-only from `odoo_leads` table
- ERP data: read from `activity_events`, `machines`, `deliveries`, `orders`, etc.
- All access logged in `activity_events` with source = "architect_diagnostic"

---

## Part 3: Frontend Changes (EmpireBuilder.tsx only)

### 3A: Fix Ticket Panel

Add a collapsible "Fix Tickets" panel to the Empire Builder landing page (alongside existing Projects and Memory sections):
- Shows count of open tickets
- Each ticket shows: severity badge, system_area, status, description snippet
- Click to expand: full details, screenshot thumbnail, verification status
- "Copy Lovable Prompt" button for tickets with fix_output_type = "lovable_prompt"

### 3B: Screenshot Integration

When a user attaches a screenshot in the Empire Builder chat:
- Auto-detect it as a potential bug report
- The Architect agent will use `diagnose_from_screenshot` tool
- Present structured diagnosis and create a fix_ticket automatically
- Show fix ticket ID in the response

### 3C: Verification Status Display

In chat responses, when the Architect reports a fix:
- Show verification status badge (PASS/FAIL/PENDING)
- If FAIL: clearly state "Not resolved -- returning to In Progress"
- If no verification was run: show warning "Unverified fix"

---

## Part 4: Audit Logging

All diagnostic queries from the Architect agent will be logged in `activity_events`:
- `entity_type`: "fix_ticket" or "diagnostic"
- `source`: "architect_agent"
- `metadata`: includes which systems were queried, what data was read (no secrets)

This uses the existing `activity_events` table -- no new tables needed for audit.

---

## Technical Details

### Files Modified:
1. **Database migration** -- Create `fix_tickets` table + RLS + validation trigger
2. **`supabase/functions/ai-agent/index.ts`** -- Empire section only:
   - Add tool definitions (~lines 5936-5996)
   - Add tool handlers (~lines 7568 area)
   - Update empire system prompt (~lines 2300-2416)
   - Add context fetching for fix_tickets (~lines 3358-3484)
3. **`src/pages/EmpireBuilder.tsx`** -- Add Fix Tickets panel to landing page

### Files NOT Modified:
- No changes to any other page, component, layout, or module
- No changes to AnnotationOverlay, ScreenshotFeedbackButton, or any existing feedback flow
- No changes to AccountingWorkspace, chat, or any other workspace
- No changes to auth, routing, or database functions outside of new migration
- No changes to `client.ts` or `types.ts` (auto-generated)

### Security Guarantees:
- No API keys or secrets ever sent to the client
- All QB/Odoo/ERP queries happen server-side via `svcClient` (service role)
- Architect gets only sanitized results (no tokens, no connection strings)
- All diagnostic access recorded in `activity_events`
- fix_tickets table has RLS: admins full access, reporters read-only on own tickets

