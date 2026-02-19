

# Duplicate Contact Merge System

## Problem
The contacts table has **2,679 records** with an estimated **1,500+ duplicate groups** -- contacts under the same customer sharing the same phone number or email. These were likely created by syncing from multiple sources (RingCentral, Gmail, etc.).

## Solution
Create a backend function `merge-contacts` that:
1. Identifies duplicate contact groups within each customer
2. Scores confidence (high/medium/low) based on match quality
3. Auto-merges high-confidence duplicates (exact email + phone match)
4. Logs all merges for audit trail
5. Creates human tasks for medium-confidence cases needing review

## Confidence Scoring

| Match Type | Confidence | Action |
|---|---|---|
| Same email AND same phone | **high** (100%) | Auto-merge |
| Same phone, different/null email | **medium** (75%) | Auto-merge, keep both emails |
| Same email, different/null phone | **medium** (75%) | Auto-merge, keep both phones |
| Same name only | **low** (50%) | Log for human review, no auto-merge |

## Merge Rules
- The **primary contact** (is_primary = true) is always the survivor
- If neither is primary, the **oldest** record (earliest created_at) survives
- Survivor inherits any non-null fields the other record has (email, phone, role)
- Duplicate records are deleted after merging

## Implementation

### 1. Database: Add merge audit log table
A new `contact_merge_log` table to track all merges for accountability:
- `survivor_id`, `merged_id` (the deleted contact)
- `confidence`, `match_type`, `merged_fields` (what was copied)
- `company_id`, `customer_id`, timestamps

### 2. Edge Function: `supabase/functions/merge-contacts/index.ts`
- Accepts optional `{ dry_run: true }` to preview without executing
- Accepts optional `{ customer_id: "..." }` to scope to one customer
- Groups contacts by customer, then clusters by phone/email overlap
- Applies confidence scoring and merge rules
- Returns summary: `{ merged: N, skipped: N, review_needed: N }`

### 3. Route Registration
Add config entry in `supabase/config.toml`:
```toml
[functions.merge-contacts]
verify_jwt = false
```

## Technical Details

**Edge function logic (pseudocode):**
```
1. Query all contacts grouped by customer_id
2. For each customer's contacts:
   a. Build clusters: contacts sharing phone OR email
   b. For each cluster > 1 contact:
      - Score confidence based on match fields
      - Pick survivor (is_primary > oldest)
      - Copy missing fields to survivor
      - Delete duplicates
      - Log to contact_merge_log
3. Return summary stats
```

**Migration SQL:**
```sql
CREATE TABLE public.contact_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  customer_id uuid REFERENCES customers(id),
  survivor_id uuid NOT NULL,
  merged_id uuid NOT NULL,
  confidence text NOT NULL,
  match_type text NOT NULL,
  merged_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.contact_merge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view merge logs" ON public.contact_merge_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
```

**Dry-run mode** allows previewing what would be merged before committing, so you can review the results safely first.

