

# Audit: Extract-Manifest Pipeline — Obstacles & Fixes

## Current State (from logs)

The function **is working** at runtime. The last successful run (06:55:57) extracted 27 rows from a spreadsheet. The problem you're hitting is **deployment bundle timeout**, not runtime failure.

## Identified Obstacles

### 1. Bundle Timeout — `xlsx` via esm.sh causes slow bundling

The `extract-manifest` function imports `import * as XLSX from "https://esm.sh/xlsx@0.18.5"` which is a large library (~1MB). The esm.sh CDN fetch during bundling is unreliable and times out the 60s bundle window.

**Fix**: Switch to `npm:xlsx@0.18.5` specifier. Deno resolves npm specifiers locally without CDN fetch, making bundling faster and deterministic.

### 2. Inconsistent xlsx import across functions

- `extract-manifest`: `https://esm.sh/xlsx@0.18.5` (full bundle)
- `ingest-job-logs` & `ingest-historical-barlists`: `https://esm.sh/xlsx@0.18.5/xlsx.mjs` (lighter module path)

The full bundle import in extract-manifest is the heaviest. All three should use `npm:` specifier.

### 3. Signed URL expiry risk

`getSignedFileUrl()` generates a time-limited URL. If there's any delay between upload and the edge function fetching the file, the URL could expire. The function fetches the file during processing (line 161) — this works now but is fragile.

**No code change needed** — just flagging as a latent risk.

### 4. JSON truncation repair is lossy

When the AI response is truncated (which happened in the successful run — "Initial JSON parse failed, attempting truncation repair"), the repair logic cuts at the last `},` and closes with `]}`. This silently drops rows. The function already rebuilds the summary, but users don't know rows were lost.

**Fix**: Log the count of dropped items and store it in `error_message` as a warning (not error status).

### 5. No `file_id` linked to extract rows

When rows are inserted (line 275-303), `file_id` is not set — it's not in the insert payload. This means rows can't be traced back to their source file.

**No change proposed** — minor data lineage gap, not blocking.

## Plan

### File 1: `supabase/functions/extract-manifest/index.ts`

1. Change `import * as XLSX from "https://esm.sh/xlsx@0.18.5"` → `import * as XLSX from "npm:xlsx@0.18.5"`
2. When truncation repair succeeds, store a warning in `error_message` field: `"Warning: AI response truncated, recovered N of estimated items"`

### File 2: `supabase/functions/ingest-job-logs/index.ts`

1. Change `import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs"` → `import * as XLSX from "npm:xlsx@0.18.5"`

### File 3: `supabase/functions/ingest-historical-barlists/index.ts`

1. Change `import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs"` → `import * as XLSX from "npm:xlsx@0.18.5"`

### Deployment

Redeploy `extract-manifest` after the import change. The npm specifier avoids the esm.sh CDN bottleneck that causes bundle generation timeouts.

