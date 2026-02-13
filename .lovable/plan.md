

# Clean the "New" Pipeline Column

## Root Cause

The `process-rfq-emails` edge function fetches emails where `from_address` OR `to_address` contains `@rebar.shop`. This means **outgoing emails** (from neel@rebar.shop, rfq@rebar.shop, saurabh@rebar.shop, etc.) get picked up and classified as new leads. The `shouldSkipSender` function only skips known bot/system senders, not your own team's outgoing mail.

Result: 14 of the 21 "New" leads are internal/outgoing emails that should never have been created.

## Current "New" Column Audit (21 leads)

| Category | Count | Examples | Action |
|----------|-------|----------|--------|
| Internal @rebar.shop outgoing emails | 14 | "RFQ-TSDC" x5, "Internal Communication" x2, "Daily Report", "Oakville Ford Wall" | Archive all |
| Duplicate external (Re: thread) | 1 | Torpave "Re: Trinity Lutheran Church" (duplicate of the original) | Archive duplicate |
| Legitimate external RFQs | 2 | Cadeploy, Torpave Trinity Lutheran Church (original) | Keep in New |
| Odoo sync leads | 4 | amigun Aanuoluwapo, English, Concrete-pro, Installer Daniel | Keep in New |

## Changes

### 1. Data Cleanup -- Archive the 15 junk leads

Move the 14 internal-email leads + 1 duplicate "Re:" lead to a new `archived_orphan` stage so they're out of the pipeline but not deleted (audit trail preserved). This is a one-time SQL update via migration.

### 2. Edge Function Fix -- Block internal outgoing emails

In `supabase/functions/process-rfq-emails/index.ts`, update `shouldSkipSender` to **always skip** any email where the `from_address` contains `@rebar.shop`. Your team members are senders, not leads. External customers emailing rfq@rebar.shop will have the external address in `from_address`, so they'll still pass through correctly.

Current logic (broken):
```
if from contains @rebar.shop:
  only skip if sender name matches OdooBot
  otherwise: let through (BUG -- creates leads from outgoing mail)
```

Fixed logic:
```
if from contains @rebar.shop:
  ALWAYS skip (outgoing/internal emails are never inbound RFQs)
```

### 3. Edge Function Fix -- Block "Re:/FW:" subjects without a match

Add a guard: if the subject starts with `Re:` or `FW:` and the multi-signal scoring engine found NO match (score < 0.4), escalate instead of creating a new lead. A reply to a conversation that doesn't match any existing lead is suspicious -- it shouldn't land in "New".

## Technical Details

### File: `supabase/functions/process-rfq-emails/index.ts`

**Change A -- `shouldSkipSender` function (line ~341):**
- Add rule: if `from_address` contains `@rebar.shop`, return `true` (skip). This catches all outgoing/internal emails regardless of the specific sender name.

**Change B -- Reply guard (around line ~1032, before AI classification):**
- Before calling `analyzeEmailWithAI`, check if subject starts with `Re:`, `RE:`, `Fwd:`, `FW:`. If so and no match was found (score < 0.4), escalate to Neel instead of creating a new lead. Replies without a match indicate a conversation the system lost track of.

### Database Migration

Archive the 15 bad leads:
```sql
UPDATE leads SET stage = 'archived_orphan'
WHERE stage = 'new'
  AND id IN (
    -- 14 internal @rebar.shop leads
    'd6d8b1f8-...', '1646c31b-...', '37b5ed89-...', '44ed97dc-...', 
    '480b93ed-...', '99097728-...', 'e757a2a9-...', '5c8e31fd-...', 
    'e4cbaf99-...', 'e56798f8-...', '232b304b-...', '683deae8-...', 
    'd4428bea-...', 'a5c922ed-...',
    -- 1 duplicate Re: Torpave
    'b8b58fca-...'
  );
```

## Result After Cleanup

The "New" column will have 6 clean leads:
- S01284, Cadeploy: Cadeploy Rebar Estimation (external RFQ)
- S01282, Torpave Group: Trinity Lutheran Church (external RFQ)
- S01470, amigun Aanuoluwapo (Odoo sync)
- S01471, English (Odoo sync)
- S02454, Concrete-pro's opportunity (Odoo sync)
- S02496, Installer Daniel (Odoo sync)

Future scans will never pollute "New" with internal/outgoing emails or unmatched replies again.
