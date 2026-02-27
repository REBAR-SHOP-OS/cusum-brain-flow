

## Add Packing Slip Preview with POD Signature, Print & Email

### Changes

**New file: `src/components/delivery/PackingSlipPreview.tsx`**

Full-screen modal (matching `PackingSlipTemplate` layout exactly) with:
- Branded header (logo, company name, "Packing Slip" title)
- Two info grid rows (Customer, Ship To, Delivery #, Delivery Date / Invoice #, Invoice Date, Scope)
- Items table (DW#, Mark, Quantity, Size, Type, Cut Length) with total footer
- Signature section: "Delivered By" line left empty, "Received By" renders the captured `signatureData` as an `<img>` tag (or empty line if none)
- Company footer
- **Action bar** (top-right, `print:hidden`): Print/PDF button (`window.print()`), Send Email button (prompts for email address via `window.prompt`, then calls `supabase.functions.invoke("gmail-send")` with the slip as subject + HTML body), Close button

Props: `slipMeta`, `customerName`, `siteAddress`, `items`, `signatureData`, `onClose`

**`src/pages/DeliveryTerminal.tsx`**

1. Add `showPreview` boolean state
2. Import `PackingSlipPreview`
3. After the "Delivery Confirmed" banner (line ~298), add a "Preview Packing Slip" button (visible when `completed` is true) that sets `showPreview = true`
4. Render `<PackingSlipPreview>` when `showPreview` is true, passing all slip data + `signatureData`
5. Also update the existing print-only signature section (lines 272-282) to render `signatureData` as an `<img>` in the "Received By" area when available

