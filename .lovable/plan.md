

## Plan: Fix Imperial Dimension Parsing in Extract Manifest

### Problem
The extraction fails with: `invalid input syntax for type numeric: "0'-4""`. The AI model sometimes returns dimensions in imperial format (e.g., `0'-4"`, `3'-6"`) instead of pure numbers, which the numeric database columns reject.

### Root Cause
The prompt says "keep values exactly as they appear" but the DB columns (`dim_a`, `dim_b`, etc.) are numeric. When the source document uses imperial notation, the AI faithfully returns strings like `0'-4"` which cannot be inserted.

### Fix — `supabase/functions/extract-manifest/index.ts`

**1. Add a `parseDimension` helper function** (before the serve block)
- Accepts any value (string, number, null)
- If it's already a number, return as-is
- If it's a string in imperial format like `X'-Y"` or `X' Y"`, convert to inches: `(X * 12) + Y`
- If it's a plain numeric string like `"450"`, parse to number
- If unparseable, return `null` instead of crashing

**2. Apply `parseDimension` to all dimension fields in the row mapping** (lines 367-379)
- Wrap each `item.A`, `item.B`, ..., `item.R`, `item.total_length` with `parseDimension()`
- Also apply to `weight_kg` and `quantity` for safety

This ensures any non-numeric dimension value is either converted or safely nullified, preventing the insert from failing.

### Single file change
- `supabase/functions/extract-manifest/index.ts`

