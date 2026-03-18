

## Plan: PDF Only Shows Purchased (Green) Items — Clean List, No Logo

### What to Change
Update the `generatePdf` function in `PurchasingConfirmedView.tsx` to:

1. **Filter to purchased items only** — only include items where `status === "purchased"`
2. **Remove the logo/branding** — no "Rebar.Shop Inc" footer, no dark header banner
3. **Clean list format** — simple title, date, then a numbered/bulleted list grouped by category

### Changes in `src/components/purchasing/PurchasingConfirmedView.tsx`

Rewrite the `generatePdf` function:

- **Filter**: `const purchasedItems = snapshot.filter(i => i.status === "purchased")`
- **Header**: Simple text title "Shopping List" with the due date and confirmed date — no dark banner, no colored rectangle
- **Body**: Group purchased items by category. For each category, show a bold category name, then a clean bulleted list of item titles with quantities
- **No footer logo**: Remove the "Rebar.Shop Inc" footer line entirely
- **No summary stats**: Remove the purchased/rejected/pending count section (since we only show purchased)
- **Clean styling**: Black text throughout, simple bullet points, adequate spacing

### File to Change
1. `src/components/purchasing/PurchasingConfirmedView.tsx` — rewrite `generatePdf` function only

