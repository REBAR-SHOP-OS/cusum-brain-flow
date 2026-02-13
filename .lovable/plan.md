

# Strict "New" Pipeline Column -- Classification, Matching, and Dedup Engine

## Problem
The "New" pipeline column gets polluted with follow-up emails about existing projects. Only brand-new RFQ/quote/price requests with zero prior history should appear in "New". Everything else must route to the existing lead as an activity log.

## Architecture Overview

All changes are in **one file**: `supabase/functions/process-rfq-emails/index.ts`. The current matching engine is weak (sender email, fuzzy company, 2-token subject overlap). We'll replace it with a multi-signal scoring engine, an uncertain-match escalation workflow, and stricter dedup.

```text
Inbound Email
     |
  [Pre-filter bots/system]
     |
  [Already processed? skip]
     |
  [Multi-Signal Matching Engine]  <-- NEW
     |  Score >= 0.8 --> Route to existing lead (activity log)
     |  Score 0.4-0.79 --> Escalate to neel@rebar.shop with top 3 candidates
     |  Score < 0.4 --> Proceed to AI classification
     |
  [AI Classification] (existing)
     |
  [Keyword fast-track] (existing)
     |
  is_lead = true --> Create lead in "new" stage
  is_lead = false --> filtered
```

---

## 1. Multi-Signal Matching Engine (replaces `findMatchingLead`)

New function: `scoreEmailAgainstLead()` returns a 0-1 confidence score using weighted signals:

| Signal | Weight | Logic |
|--------|--------|-------|
| **Gmail thread_id match** | 0.95 | If `communications.thread_id` matches an email already linked to a lead via `lead_id`, it's the same conversation |
| **In-Reply-To / References header** | 0.90 | Extract from `metadata.headers`, match against `source_id` of emails already linked to leads |
| **Sender email + same customer** | 0.40 | Sender's email resolves to a `customer_id` that has active leads |
| **Subject similarity** | 0.30 | Token overlap after stripping Re:/Fwd: prefixes, scored as Jaccard coefficient |
| **RFQ/Job reference extraction** | 0.50 | Regex patterns for reference numbers: `S\d{5}`, `RFQ-\d+`, `Job#\d+`, `PO-\d+`, project numbers in subject/body |
| **Attachment filename match** | 0.20 | If attachment filenames match files already stored on an existing lead |

Signals are combined: `finalScore = max(thread_id_score, max(individual_scores), weighted_sum_of_remaining / total_weight)`. Thread and header matches are near-deterministic and short-circuit.

---

## 2. RFQ / Job Reference Extraction

New helper: `extractReferences(subject, body)` returns an array of matched reference strings.

Patterns:
- `S\d{4,5}` (internal lead numbers like S00142)
- `RFQ-?\d+`, `RFI-?\d+`  
- `Job\s*#?\s*\d+`, `Project\s*#?\s*\d+`
- `PO-?\d+`, `Quote-?\d+`
- `\d{2}-\d{4,6}` (common contractor reference format)

These are matched against `leads.title`, `leads.metadata->>'rfq_ref'`, and `leads.notes`.

---

## 3. Confidence Thresholds and Routing

| Score | Action |
|-------|--------|
| >= 0.8 | **Auto-route**: Attach as activity to the matched lead. Do NOT create a new lead. Log the routing in `lead_activities`. |
| 0.4 - 0.79 | **Escalate**: Send a confirmation email to `neel@rebar.shop` listing top 3 candidate leads with scores. Create a `human_tasks` record with severity "warning". Do NOT create a new lead yet -- mark the email as "pending_review" in a new metadata field. |
| < 0.4 | **No match**: Proceed to AI classification. If it's a lead, create it in "new" stage as today. |

---

## 4. Escalation Email to neel@rebar.shop

When confidence is 0.4-0.79, the function will:

1. Insert a `human_tasks` row:
   - `title`: "Review: Is this email about an existing project?"
   - `description`: Email subject, sender, snippet, plus top 3 candidate leads with scores
   - `severity`: "warning"
   - `status`: "open"
   - `metadata`: `{ email_id, candidates: [{lead_id, lead_title, score}...] }`

2. Send an email via `gmail-send` edge function:
   - **To**: neel@rebar.shop
   - **Subject**: "[Action Required] New email may belong to existing project"
   - **Body**: Formatted with sender info, subject, snippet, and the top 3 candidate projects with confidence scores

3. The email is NOT created as a new lead. It stays in limbo until Neel acts on the human task.

---

## 5. Dedup Policy Enhancements

Current dedup checks `source_email_id` against `leads` and `lead_activities`. We'll add:

- **Thread-level dedup**: If any email in the same Gmail thread (`communications.thread_id`) has already been processed (exists in `leads.source_email_id` or `lead_activities.metadata->source_email_id`), route to that lead instead of creating a new one.
- **Customer + time window dedup**: If the same `customer_id` created a lead in the last 48 hours with similar subject tokens (Jaccard > 0.5), route to the existing lead instead of creating a duplicate.
- **Reference number dedup**: If extracted references (S-numbers, RFQ numbers) match an existing lead's title or metadata, always route to that lead.

---

## 6. New Metadata Fields on Leads

Store routing-critical fields in `leads.metadata` (JSONB, no schema migration needed):

- `thread_id`: Gmail thread ID of the originating email  
- `external_refs`: Array of extracted reference numbers (RFQ-xxx, Job#xxx, etc.)
- `rfq_ref`: Primary RFQ reference if detected
- `email_message_ids`: Array of Gmail Message-IDs for header-based matching
- `routing_confidence`: Score that led to this lead being created (for auditing)

---

## 7. UI Rule: "New" Column Stays Clean

No frontend changes needed. The backend changes ensure:
- Follow-ups route to existing leads (activity log, not new lead)
- Uncertain matches get held for human review (not created in "New")
- Only genuinely new, unmatched RFQs land in "New"

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/process-rfq-emails/index.ts` | Replace `findMatchingLead` with multi-signal scoring engine; add `extractReferences` helper; add `scoreEmailAgainstLead` function; add escalation logic (human_tasks insert + gmail-send call); enhance dedup checks; store thread_id/refs in lead metadata |

## Edge Cases Handled

- **Same customer, different project**: Reference extraction + subject similarity prevent merging unrelated projects. Low subject overlap + no reference match = new lead.
- **Forwarded RFQs from team members**: Internal @rebar.shop emails are already filtered by `shouldSkipSender`, but real team forwards (not OdooBot) pass through and get scored normally.
- **Multiple leads per customer**: The scoring engine checks ALL active leads for a customer, not just the first one. Returns the highest-scoring match.
- **Neel doesn't respond to escalation**: The email sits as an open `human_tasks` item. A future scan won't re-process it because `source_email_id` is tracked in a "pending_review" set persisted in the function's dedup check.
