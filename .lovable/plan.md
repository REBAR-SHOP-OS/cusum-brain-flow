
# Two Surgical Fixes: Draggable Chat Box + Create Invoice Parity with Edit Invoice

## Fix 1: Make DockChatBox Draggable by Header

**File: `src/components/chat/DockChatBox.tsx`**

Add mouse-based drag support so the chat window can be repositioned by grabbing the header bar.

### Changes
- Add `dragOffset` state `{ x: number; y: number }` initialized to `{ x: 0, y: 0 }`
- Add `isDragging` and `dragStart` refs to track drag state
- `onMouseDown` on the header div (not the buttons) records start position, attaches global `mousemove` and `mouseup` listeners
- `mousemove` updates `dragOffset` by calculating delta from start
- `mouseup` cleans up listeners
- Apply offset via `transform: translate(${x}px, ${y}px)` merged into the existing `style` prop on the outer container
- All header action buttons get `onMouseDown={(e) => e.stopPropagation()}` to prevent drag when clicking minimize/close/maximize
- Header gets `cursor-grab` / `cursor-grabbing` styles
- Reset `dragOffset` to `{0, 0}` when minimized (snap back to dock position)
- Guard: `user-select: none` during drag to prevent text selection

### What does NOT change
- Message rendering, file attachments, send logic, minimized state behavior -- all untouched
- The `style` prop from DockChatBar (right offset) -- preserved and combined with drag offset

---

## Fix 2: Create Invoice Dialog -- Full Parity with Edit Invoice

**File: `src/components/customers/CreateTransactionDialog.tsx`**

The Create Invoice dialog is missing many fields that the Edit Invoice (InvoiceEditor) has. Add them inside a collapsible "Additional Details" section so the dialog stays clean for simple invoices but offers full parity when expanded.

### New State Variables (8 fields + 1 toggle)
```
billAddr, shipAddr, termsValue, shipVia, shipDate, trackingNum, poNumber, salesRep
showDetails (boolean, default false)
```

### New Imports
- `Collapsible, CollapsibleTrigger, CollapsibleContent` from `@/components/ui/collapsible`
- `ChevronDown` from `lucide-react`
- `Textarea` is already imported

### LineItem Interface Change
```typescript
interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  serviceDate?: string;  // NEW
}
```

### UI Layout Changes

**Between Due Date and Line Items**, add a collapsible section (only for Invoice/Estimate types):

```
[v Additional Details]  (click to expand)
  +-------------------------------------------+
  | Billing Address   | Shipping Address       |
  | [textarea]        | [textarea]             |
  |-------------------------------------------|
  | Terms [dropdown]  | Ship Via [input]       |
  | Ship Date [date]  | Tracking No. [input]   |
  | P.O. Number       | Sales Rep              |
  +-------------------------------------------+
```

This uses a 2-column grid matching InvoiceEditor's layout.

**Line Items grid** adds a Service Date column:

Before: `[Product | Description | Qty | Unit Price | Amount | Delete]`
After:  `[Product | Description | Svc Date | Qty | Unit Price | Amount | Delete]`

Grid template updates from 6 columns to 7 columns when products exist, or 6 columns when no products.

### Save Logic Update (`handleSubmit`)

Add sparse fields to the `body` object (only if non-empty):

```typescript
if (billAddr) body.billAddr = billAddr;
if (shipAddr) body.shipAddr = shipAddr;
if (termsValue) body.terms = termsValue;
if (shipVia) body.shipVia = shipVia;
if (shipDate) body.shipDate = shipDate;
if (trackingNum) body.trackingNum = trackingNum;

const customFields = [];
if (poNumber) customFields.push({ Name: "P.O. Number", StringValue: poNumber, Type: "StringType" });
if (salesRep) customFields.push({ Name: "Sales Rep", StringValue: salesRep, Type: "StringType" });
if (customFields.length) body.customFields = customFields;
```

Each line item includes `serviceDate` when set:
```typescript
body.lineItems = lineItems
  .filter((li) => li.description.trim())
  .map((li) => ({
    description: li.description,
    quantity: li.qty,
    unitPrice: li.unitPrice,
    amount: li.qty * li.unitPrice,
    ...(li.serviceDate ? { serviceDate: li.serviceDate } : {}),
  }));
```

### Reset on Submit

All 8 new fields reset to empty strings on successful submission alongside existing resets.

### Guards
- All new fields are optional -- empty values excluded from payload via sparse serialization
- Collapsible section starts collapsed -- no visual clutter for quick invoices
- Terms dropdown uses same options as InvoiceEditor: `["Net 15", "Net 30", "Net 60", "Due on receipt"]`
- No new dependencies, no schema changes, no database modifications
