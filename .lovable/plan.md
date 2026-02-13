

# Audit & Improve Lead Detail Drawer (Odoo Parity)

## Problem
The lead detail drawer is missing key fields that Odoo prominently displays: email, phone, responsible salesperson, contact name, Odoo probability, and revenue. These are stored in `metadata` but only partially surfaced, mostly in the "Details" tab rather than upfront.

## Changes

### 1. LeadDetailDrawer.tsx -- Surface Key Fields in Header

Add a compact "key info" section between the badges and quick actions, displaying:
- **Customer/Contact** name (from `metadata.odoo_contact` or `customers.name`)
- **Email** (from `metadata.odoo_email`, clickable mailto link)
- **Phone** (from `metadata.odoo_phone`, clickable tel link)
- **Responsible/Salesperson** (from `metadata.odoo_salesperson`, with avatar initials)
- **Expected Revenue** (from `metadata.odoo_revenue` or `lead.expected_value`)
- **Probability** (from `metadata.odoo_probability` or `lead.probability`) shown inline with a small progress indicator
- **Expected Closing** date

This mirrors Odoo's layout where these fields are visible at the top of the form without switching tabs.

### 2. LeadDetailDrawer.tsx -- Improve Stage Navigation

Replace the current single "Move to Next Stage" button with a horizontal scrollable stage bar (similar to Odoo's stage tabs at the top). Each stage is a clickable pill/chip showing the stage name, with the current stage highlighted. This lets users jump to any stage directly, not just the next one.

### 3. LeadDetailDrawer.tsx -- Details Tab Cleanup

Since key fields are now in the header, the Details tab will focus on:
- Estimation weight (from metadata if available)
- Tags
- Source
- SLA deadline/breach status
- Pipeline progress bar (kept for visual reference)

### Technical Details

All data is already available in the `lead` object:
- `lead.metadata` contains: `odoo_email`, `odoo_phone`, `odoo_contact`, `odoo_salesperson`, `odoo_probability`, `odoo_revenue`, `odoo_stage`
- `lead.customers` has `name` and `company_name`
- `lead.expected_value`, `lead.probability`, `lead.expected_close_date` are direct fields

No database changes needed. No new queries needed. This is purely a UI restructuring of `LeadDetailDrawer.tsx` to better surface existing data.

### File Changes
- **`src/components/pipeline/LeadDetailDrawer.tsx`** -- Restructure header to show key fields inline (email, phone, salesperson, revenue, probability, closing date); add stage navigation chips; clean up Details tab to avoid duplication.
