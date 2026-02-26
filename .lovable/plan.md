

# Add "View" Buttons Across All Accounting Table Sections

## What Changes

Add an **Eye / View** button to every accounting table that's currently missing one. Clicking "View" opens a side drawer (Sheet) showing the full details of that record.

## Sections Needing View

| Section | Current State | Change |
|---|---|---|
| **AccountingEstimates.tsx** | Has Convert + Send, no View | Add Eye/View button + detail Sheet |
| **AccountingBills.tsx** | Bills table has no Actions column | Add Actions column with View button + detail Sheet |
| **AccountingCreditMemos.tsx** | No Actions column | Add Actions column with View button + detail Sheet |
| **AccountingPayments.tsx** | No Actions column | Add Actions column with View button + detail Sheet |
| **AccountingSalesReceipts.tsx** | No Actions column | Add Actions column with View button + detail Sheet |
| **AccountingExpenses.tsx** | No Actions column | Add Actions column with View button + detail Sheet |

*AccountingInvoices and AccountingDocuments already have View buttons -- no changes needed.*

## How It Works

Each section gets:
1. A new **Actions** column (or View added to existing actions) in the table
2. An `Eye` icon button labeled "View"
3. A **Sheet** (side drawer) that slides in from the right showing the record's full details (all fields displayed in a clean layout)
4. State: `selectedItem` to track which record is being viewed

## Technical Details

**Pattern** (same across all 6 files):
```text
+ import { Eye } from "lucide-react"
+ import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
+ const [selectedItem, setSelectedItem] = useState<...| null>(null)

Table:
+ <TableHead>Actions</TableHead>
+ <TableCell>
+   <Button size="sm" variant="ghost" onClick={() => setSelectedItem(row)}>
+     <Eye className="w-4 h-4" /> View
+   </Button>
+ </TableCell>

Sheet:
+ <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
+   <SheetContent> ... detail fields ... </SheetContent>
+ </Sheet>
```

**Detail Sheet content per type:**
- **Estimate**: Doc#, Customer, Date, Expiry, Amount, Status, line items if available
- **Bill**: Doc#, Vendor, Date, Due, Total, Balance, Status
- **Credit Memo**: CM#, Customer, Date, Amount, Remaining Credit, Status
- **Payment**: Date, Customer, Amount, Payment Method
- **Sales Receipt**: Doc#, Customer, Date, Amount, Memo
- **Expense**: Date, Payee, Account, Type, Ref#, Amount, Note

