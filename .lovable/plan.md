

## Match Delivery Terminal Print to PackingSlipTemplate Branding

The current print output is a plain checklist. It needs to match the professional branded layout of `PackingSlipTemplate.tsx` — with logo, company header, bordered info grids, a proper items table, signature lines, and footer.

### Changes

**`src/pages/DeliveryTerminal.tsx`**

1. **Fetch additional packing slip fields** — expand the `select` query to include `slip_number`, `invoice_number`, `invoice_date`, `ship_to`, `scope`, `delivery_date` and store them in state.

2. **Replace the print-only header** (lines 162–166) with the full branded layout matching `PackingSlipTemplate`:
   - Import `brandLogo` from `@/assets/brand-logo.png`
   - Company header: logo + "Rebar.Shop Inc" + address on the left, "Packing Slip" title on the right
   - Info grid row 1 (4 cols, bordered): Customer, Ship To, Delivery #, Delivery Date
   - Info grid row 2 (3 cols, bordered): Invoice #, Invoice Date, Scope
   - Items table with columns: DW#, Mark, Quantity, Size, Type, Cut Length — replacing the current checkbox grid
   - Total quantity row in the table footer
   - Dual signature lines: "Delivered By" and "Received By"
   - Footer: phone, email, website, tax number

3. **Hide the on-screen checklist from print** — add `print:hidden` to the existing interactive checklist `<div>` so it doesn't double-render on paper.

4. **Derive table data from `items_json`** — map each `ChecklistItem` to the table row format: `drawing_ref` → DW#, `mark_number` → Mark, `total_pieces` → Quantity, `bar_code` → Size, `cut_length_mm` → Cut Length (converted to meters).

No changes to `PackingSlipTemplate.tsx`, `index.css`, or any other files.

