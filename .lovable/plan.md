

## Redesign PackingSlipTemplate to Match Reference

The current template has a generic Date/Description/Quantity table. The reference shows a rebar-specific packing slip with distinct fields and layout.

### Changes to `src/components/accounting/documents/PackingSlipTemplate.tsx`

**New data interface:**
- Replace `PackingSlipItem` fields: `date/description/quantity` → `dwNumber, mark, quantity, size, type, cutLength`
- Add to `PackingSlipData`: `deliveryNumber`, `deliveryDate`, `scope`, remove `salesRep`, `inclusions`

**New layout (matching reference):**
1. **Header**: Logo + "Rebar.Shop Inc" + address left, "Packing Slip" right (keep existing)
2. **Info grid row 1** (4 cols, bordered): Customer, Ship To, Delivery #, Delivery Date
3. **Info grid row 2** (3 cols, bordered): Invoice #, Invoice Date, Scope
4. **Items table** with columns: DW#, Mark, Quantity, Size, Type, Cut Length
   - Quantity bold, right-aligned; Size left-aligned with spacing gap
   - Total row at bottom summing quantity
5. **Signature section**: Two side-by-side lines — "Delivered By (Signature)" and "Received By (Signature)"
6. **Footer**: Phone, email, website, tax number (keep existing)

### Files to update for callers

**`src/components/accounting/AccountingInvoices.tsx`** — Update `getPackingSlipData` to map to new interface fields (deliveryNumber, deliveryDate, scope, new item shape)

**`src/components/accounting/AccountingDocuments.tsx`** — Same update to its `getPackingSlipData`

