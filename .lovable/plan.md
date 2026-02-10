

# Odoo-to-Pipeline Migration Plan

## Status: Phase 1 & 3 ✅ COMPLETE

### What's Done

1. **`sync-odoo-leads` edge function** — Parses OdooBot emails, extracts lead names/stages/assignees/deadlines, creates leads with `source: "odoo_sync"` and full deduplication
2. **"Sync Odoo" button** on Pipeline page (next to Scan RFQ)
3. **Source badges** on LeadCard — shows Odoo / Email / Manual badges

### First Sync Results
- 7 leads created from 16 OdooBot emails
- Duplicates properly handled (batch + existing lead matching)
- Leads: amigun Aanuoluwapo, English, Lucan Biddulph WWTP, Mount Carmel Reservoir, etc.

### Phase 2: Multi-Mailbox (Pending)
Expand RFQ scanner to scan all team mailboxes (vicky, ai, neel, ben, saurabh). Requires updating `process-rfq-emails` to iterate over `user_gmail_tokens` for multiple addresses.

### Safety
- All synced leads tagged `source: "odoo_sync"` + `source_email_id: "odoo_{comm_id}"`
- Existing leads never overwritten — only stage updates
- Odoo stays completely untouched
