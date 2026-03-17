

## Sales Hub — SELECT INTERFACE Page

### What
Create a new `src/pages/sales/SalesHub.tsx` page with the same dark, glowing "SELECT INTERFACE" design as `ShopFloor.tsx`, but titled **SALES DEPARTMENT** with 4 hub cards:

| Card | Subtitle | Icon | Route |
|------|----------|------|-------|
| PIPELINE | DEALS & STAGES | `TrendingUp` | `/sales/pipeline` |
| QUOTATIONS | ESTIMATES & BIDS | `FileText` | `/sales/quotations` |
| INVOICES | BILLING & PAYMENTS | `Receipt` | `/sales/invoices` |
| CONTACTS | CLIENTS & LEADS | `Users` | `/sales/contacts` |

### Changes

**1. New file: `src/pages/sales/SalesHub.tsx`**
- Clone the layout/style from `ShopFloor.tsx` (radial glow background, header, card grid, back link)
- Replace title with "SALES DEPARTMENT" and subtitle "Sales Environment Active"
- 4 cards in a 2×2 grid (responsive to 4 columns on large screens)
- Each card links to the existing `/sales/*` routes
- Back link goes to `/home`

**2. `src/App.tsx`**
- Add lazy import for `SalesHub`
- Add route: `/sales` → `<SalesHub />`

