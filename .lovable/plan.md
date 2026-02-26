

## Plan: Add Customer & Product Dropdowns with Visible Font Colors

### Problem
- Customer field is a plain text input; needs a searchable dropdown with "Add New Customer" at the top, followed by existing customers from the `customers` table.
- Description field is a plain text input; needs a searchable product dropdown pulling from the `qb_items` table (Service/Inventory types, not Category), auto-filling unit price when selected.
- Input fields have dark backgrounds making text invisible on the white quotation form.

### File: `src/components/accounting/documents/DraftQuotationEditor.tsx`

**1. Fix font/color visibility on all inputs**
- Add explicit `bg-white text-gray-900 border-gray-300` classes to all `<Input>` and `<textarea>` elements inside the white quotation form so text is always readable.

**2. Customer dropdown (replace text input)**
- Fetch customers from `customers` table on mount (`SELECT id, name FROM customers ORDER BY name`).
- Replace the customer name `<Input>` with a custom searchable dropdown (Popover + Command pattern or simple filtered list):
  - First option: **"+ Add New Customer"** — clicking it shows inline inputs for name + address, and inserts into `customers` table on save.
  - Below that: filterable list of existing customers. Selecting one sets `customerName` and optionally auto-fills address.
- Keep the address input below for manual override.

**3. Product/Service dropdown (replace description input)**
- Fetch products from `qb_items` table on mount (`SELECT id, name, unit_price, description FROM qb_items WHERE is_deleted = false AND type != 'Category' ORDER BY name`).
- Replace each line item's description `<Input>` with a searchable dropdown (Popover + filtered list):
  - Type to filter products by name.
  - Selecting a product auto-fills `description` (product name) and `unitPrice` (from `unit_price` column).
  - Allow free-text entry for custom items not in the list.

### Files to modify
- **`src/components/accounting/documents/DraftQuotationEditor.tsx`** — all changes in this single file

