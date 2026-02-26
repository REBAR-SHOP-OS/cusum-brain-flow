

## Plan: Add Packing Slip Items & Checklist to Driver Drop-Off Page

The driver drop-off page currently only shows photo capture and signature. The user wants it to display all the packing slip line items (like the attached image: DW#, Mark, Quantity, Size, Type, Cut Length) with checkmarks, so the driver can verify what was delivered before signing.

### Changes

#### `src/pages/DriverDropoff.tsx` — Major update

1. **Fetch packing slip data**: Query `packing_slips` by `delivery_id` (from the stop's `delivery_id`) to get `items_json`, `customer_name`, `slip_number`, `scope`, `invoice_number`, `invoice_date`, `ship_to`

2. **Add item checklist with checkmarks**: Display the items from `items_json` as a table/card list with columns matching the packing slip image:
   - DW# (`drawing_ref`)
   - Mark (`mark_number`)
   - Quantity + Size (`total_pieces` + `bar_code`)
   - Type (Bent if `asa_shape_code`, else Straight)
   - Cut Length (`cut_length_mm / 1000` in meters)
   - Each item gets a checkbox the driver taps to confirm it was delivered
   - Total row at the bottom

3. **Packing slip header info**: Show customer name, slip number, delivery number, invoice #, scope — matching the layout in the attached image

4. **Reorder sections**: 
   - Packing slip header (customer, delivery #, invoice, scope)
   - Items checklist with checkmarks
   - Site photo capture
   - Customer signature pad
   - Complete Drop-Off button

5. **Update `canSubmit`**: Require all items checked + photo + signature before enabling completion

6. **Add checked item state**: `useState<Set<number>>` to track which items the driver has confirmed

### Layout (mobile)
```text
┌──────────────────────────────┐
│ ← DROP-OFF  DEL-4569-01     │
│ 123 Main St  [Navigate]     │
├──────────────────────────────┤
│ CUSTOMER: ACTION HOME SVCS  │
│ Slip: PS-4569-01            │
│ Invoice: 4569 | Scope: ...  │
├──────────────────────────────┤
│ ☑ R01  15A09  3×15M  Bent   │
│ ☑ R01  15A18 10×15M  Bent   │
│ ☐ R02  AS18   6×10M  Str    │
│ ...                         │
│ Total: 47 pcs               │
├──────────────────────────────┤
│ 📷 Site Photo [tap]         │
├──────────────────────────────┤
│ ✍️ Customer Signature       │
│ ┌────────────────────────┐  │
│ │   SignaturePad         │  │
│ └────────────────────────┘  │
├──────────────────────────────┤
│ [  ✓ Complete Drop-Off     ]│
│ 3/6 items checked           │
└──────────────────────────────┘
```

### Files
- **Edit**: `src/pages/DriverDropoff.tsx` — add packing slip fetch, item checklist with checkboxes, header info section

