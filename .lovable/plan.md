

# Add Missing QuickBooks Invoice Fields to InvoiceEditor

## What's Missing (from the screenshot)

The current InvoiceEditor only has: Customer, Invoice Date, Due Date, Description/Qty/Rate/Amount line items, Memo, and Totals. The QuickBooks UI (circled in the screenshot) shows additional fields that need to be added.

## Changes -- Single File: `src/components/accounting/InvoiceEditor.tsx`

### 1. New Header Fields Section (between Bill To and Line Items)

Add a grid of editable metadata fields that mirror QuickBooks:

- **Billing Address** (textarea, left column) -- read from `invoice.BillAddr` (QuickBooks stores this as `BillAddr.Line1`, `City`, etc.), editable in edit mode
- **Shipping Address** (textarea, below billing) -- read from `invoice.ShipAddr`
- **Terms** (dropdown) -- read from `invoice.SalesTermRef`, options: Net 15, Net 30, Net 60, Due Upon Receipt
- **Ship Via** (text input) -- read from `invoice.ShipMethodRef`
- **Shipping Date** (date input) -- read from `invoice.ShipDate`
- **Tracking No.** (text input) -- read from `invoice.TrackingNum`
- **PO Number** (text input) -- read from `invoice.PONumber` (custom field on the raw invoice)
- **Sales Rep** (text input) -- read from `invoice.SalesRep` or custom field

All fields are **read-only in view mode** and become editable inputs when the user clicks Edit. In view mode, empty fields are hidden to keep the invoice clean.

### 2. Product/Service Dropdown in Line Items

Replace the plain Description `<Input>` with a two-part cell:

- A `<Select>` dropdown populated from the `items` prop (already passed in) filtered to `Active === true`
- When a product is selected, auto-fill `Description` with `item.Description || item.Name` and `UnitPrice` with `item.UnitPrice`
- The Description input remains below/beside for custom text override
- Guard: if `items` array is empty, fall back to the current plain text input

### 3. Service Date Column

Add a "Service Date" column to the line items table (only visible in edit mode, or when data exists in view mode). This maps to `SalesItemLineDetail.ServiceDate` in QuickBooks.

### 4. Save Logic Update

The `handleSave` function's `updates` object will include the new fields:

- `BillAddr`, `ShipAddr`, `SalesTermRef`, `ShipMethodRef`, `ShipDate`, `TrackingNum`, `CustomField` (for PO Number)
- Line items will include `ServiceDate` and `ItemRef` when a product is selected
- Guards: only include fields in the payload that have actually changed (sparse update)
- Throttle: the existing `saving` state already prevents double-submission

### 5. No Schema Changes, No New Files, No New Dependencies

- All data comes from the existing `invoice` object (raw QuickBooks data) and the `items` prop
- The `cmdk` package is already installed but using a simple `<Select>` from Radix is cleaner and consistent with the existing pattern
- No database migration needed -- these fields already exist in QuickBooks and flow through the existing sync

## Visual Layout (View Mode)

```text
+----------------------------------+----------------------------+
| Bill To                          | Payment History            |
| Customer Name                    | PAID / PARTIAL / OPEN      |
+----------------------------------+----------------------------+
| Billing Address  | Terms: Net 30   | Inv Date  | Due Date     |
| 123 Main St...   | Ship Via: UPS   | Ship Date | Tracking #   |
| Shipping Address | PO#: 12345      | Sales Rep: John          |
+----------------------------------+----------------------------+
| # | Service Date | Product/Service | Description | Qty | Rate | Amount |
|---|-------------|-----------------|-------------|-----|------|--------|
| 1 | 2026-02-17  | Rebar 10M       | Fabrication | 100 | 2.50 | 250.00 |
+------------------------------------------------------------------+
```

Empty fields are hidden in view mode to keep the invoice clean.
