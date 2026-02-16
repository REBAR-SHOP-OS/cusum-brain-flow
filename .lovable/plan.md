

# Rebar AI Code Engineer — Adapted for Your Platform

## Important: Platform Reality

Your project runs on **Lovable Cloud** (React + Supabase Edge Functions in Deno/TypeScript). It cannot run Python, FastAPI, or Docker. However, your existing architecture already has **most of the building blocks** for a production-grade AI Code Engineer. Here's what we actually need to build vs what already exists.

## What Already Exists (No Changes Needed)

| Capability | Where It Lives |
|---|---|
| Agent runtime with tools | `ai-agent` edge function (6,500+ lines) |
| Odoo Read (search_read) | `odoo-crm-sync`, `odoo-file-proxy`, `odoo-reconciliation-report` |
| Venture management tools | `manage_venture` tool in ai-agent |
| Cross-platform diagnostics | `diagnose_platform` tool (ERP, WordPress, Odoo) |
| Fix request creation | `create_fix_request` tool |
| WordPress tools | `wp_*` tools (get/create/update posts, pages, products, SEO) |
| File analysis (ZIP, PDF, image) | EmpireBuilder.tsx + ai-agent Gemini Vision |
| Auto-fix from errors | SmartErrorBoundary "Fix with ARIA" button |
| Friday ideas cron | `friday-ideas` edge function |
| Model routing (Gemini/GPT) | `selectModel()` in ai-agent |
| Chat UI | EmpireBuilder.tsx (Lovable-style) |

## What Needs to Be Built (5 Items)

### 1. Odoo Write Tool (New)

Add an `odoo_write` tool to the empire agent that can **create and update** records in any Odoo model via JSON-RPC. Currently, Odoo integration is read-only.

**File**: `supabase/functions/ai-agent/index.ts`
- Add tool definition: `odoo_write` with params `model`, `action` (create/write), `record_id`, `values`
- Add handler that calls Odoo JSON-RPC `execute_kw` with `create` or `write` method
- Security: require explicit `confirm: true` flag for destructive operations
- Uses existing `ODOO_URL`, `ODOO_API_KEY`, `ODOO_DATABASE` secrets

### 2. Odoo Module Patch Tool (New)

Add an `odoo_module_patch` tool that generates a **reviewable diff** for Odoo module modifications (Python files). The AI produces the patch as a structured artifact -- it never executes code directly.

**File**: `supabase/functions/ai-agent/index.ts`
- Add tool: `generate_patch` with params `target` (odoo_module/erp_code/wordpress), `file_path`, `description`, `patch_type` (unified_diff)
- AI generates a unified diff format patch as an artifact
- Store patches in a new `code_patches` table for review/approval
- Frontend shows Approve/Reject buttons

### 3. Structured JSON Output Contract (New)

Force the empire agent to return structured JSON instead of prose when executing engineering tasks.

**File**: `supabase/functions/ai-agent/index.ts`
- Add a `code_engineer_mode` flag triggered by keywords like "generate patch", "write code", "fix module", "engineer mode"
- When active, wrap the system prompt to enforce JSON schema output:

```text
{
  "status": "success | error",
  "plan": [{ "step": 1, "action": "...", "target": "..." }],
  "actions": [{ "tool": "...", "params": {...}, "result": {...} }],
  "artifacts": [{ "type": "patch", "file": "...", "content": "..." }],
  "errors": [{ "code": "...", "message": "..." }]
}
```

### 4. Code Patches Table + Review UI (New)

**Database migration**: Create `code_patches` table:
- `id`, `created_by`, `company_id`, `target_system` (odoo/erp/wordpress)
- `file_path`, `description`, `patch_content` (the diff)
- `status` (pending/approved/rejected/applied)
- `reviewed_by`, `reviewed_at`
- RLS: users can see own patches, admins can approve

**File**: `src/pages/EmpireBuilder.tsx`
- When the AI returns artifacts with patches, render them in a code block with syntax highlighting
- Add "Approve" and "Reject" buttons below each patch
- Approved patches update the `code_patches` table status

### 5. Validation Tool (New)

Add a `validate_code` tool that performs basic static validation on generated patches.

**File**: `supabase/functions/ai-agent/index.ts`
- Checks: valid Python syntax (for Odoo patches), matching brackets/indentation, no dangerous patterns (DROP TABLE, rm -rf, eval/exec)
- Returns structured validation result with warnings and errors
- Runs automatically before presenting patches to the user

## Architecture Diagram

```text
+-------------------+        +---------------------+
|  EmpireBuilder    |        |  ai-agent (Deno)    |
|  (React Chat UI)  | -----> |  Agent Runtime      |
|                   |        |                     |
|  - File upload    |        |  Tools:             |
|  - Patch review   |        |  - manage_venture   |
|  - Approve/Reject |        |  - diagnose_platform|
+-------------------+        |  - create_fix_req   |
                             |  - odoo_write  [NEW]|
                             |  - generate_patch[N]|
                             |  - validate_code [N]|
                             |  - wp_* tools       |
                             +----------+----------+
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
              +-----+-----+     +------+------+     +-----+-----+
              | Odoo CRM  |     | ERP DB      |     | WordPress |
              | JSON-RPC  |     | (Supabase)  |     | REST API  |
              +-----------+     +-------------+     +-----------+
```

## Security Guardrails

- No direct code execution -- all patches are reviewable text artifacts
- Odoo writes require `confirm: true` flag
- No destructive DB operations (DELETE, DROP) without explicit admin approval
- All patches stored in `code_patches` with audit trail
- Validation tool scans for dangerous patterns before presenting patches

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase/functions/ai-agent/index.ts` | Add `odoo_write`, `generate_patch`, `validate_code` tools + handlers + code engineer mode |
| `src/pages/EmpireBuilder.tsx` | Add patch review UI (code block + Approve/Reject buttons) |
| Database migration | Create `code_patches` table with RLS |

## What This Does NOT Include (and Why)

| Requested | Why Not |
|---|---|
| FastAPI backend | Lovable cannot run Python -- Supabase Edge Functions (Deno/TS) serve the same role |
| Docker / Render deployment | Lovable Cloud handles deployment automatically |
| Next.js frontend | Project uses React/Vite -- same capabilities, different framework |
| Separate `agents/`, `tools/`, `schemas/` dirs | Already organized within the 6,500-line ai-agent function with clear sections |

The end result is functionally identical: an AI agent that accepts goals, produces structured execution plans, executes via tools, generates reviewable patches, and returns structured JSON -- all within your existing production infrastructure.
