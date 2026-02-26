

## Plan: Fix Quotation Editor Layout to Match Reference Design

### File: `src/components/accounting/documents/DraftQuotationEditor.tsx`

### Changes

**1. Restructure header section (lines 248-268)**
- Keep logo + company info on left
- Right side: "Quotation #[number]" as large title, "Quote Date:" and "Due Date:" (expiration) as labeled fields below

**2. Replace Customer & Project grid (lines 271-369) with reference-style layout**
- **BILL TO** box: bordered section with "BILL TO" label + customer dropdown inside, styled like the reference
- **Shipping Address** box below: bordered section with optional shipping address + "Ship Date" field beside it (reuse project name or add ship date)
- Remove "Project" field or move it into a secondary area

**3. Update table styling (lines 372-490)**
- Keep Description, Qty, Unit Price, Amount columns — already correct
- Ensure column widths match reference (description takes most space, Qty/Unit Price/Amount are right-aligned fixed width)
- Bold header row with bottom border (already done)

**4. Update totals section (lines 508-536)**
- Show "Subtotal:" row
- Show "HST (ON) 13%:" label (currently shows generic "Tax")
- Show "Total:" with bold separator
- Add "Amount Due:" row below total (show total or $0 if paid)

**5. Minor styling**
- Ensure all text uses visible gray-900 on white background (already done)
- Match the clean bordered-box style from the reference for BILL TO and Shipping sections

### Files to modify
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — single file, layout and styling only

