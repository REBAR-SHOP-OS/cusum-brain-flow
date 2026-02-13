

# Responsive Audit — All Devices (Mobile / Tablet / Desktop)

## Summary

After inspecting the layout components, key pages, and data-heavy views across 1920px desktop, 834px tablet, and 390px mobile viewports, I found **8 issues** ranging from critical overflow bugs to cosmetic duplications.

---

## Issues Found

### CRITICAL — Content Overflow / Unusable on Mobile + Tablet

**Issue 1: PayrollOverviewTab — fixed 9-column grid overflows**
- File: `src/components/office/payroll/PayrollOverviewTab.tsx`
- The employee table uses `grid-cols-[24px_1fr_90px_70px_70px_70px_70px_60px_90px]` (minimum ~614px) with no horizontal scroll wrapper.
- On mobile (390px) and tablet (834px with sidebar), rows overflow and clip off-screen.
- **Fix**: Wrap the table in a `ScrollArea` with horizontal scrolling, or stack key columns on mobile and hide secondary columns behind a responsive breakpoint.

**Issue 2: DetailedListView — 1200px fixed min-width, no horizontal scrollbar on mobile**
- File: `src/components/office/DetailedListView.tsx`
- Uses `min-w-[1200px]` inside a `ScrollArea`. The `ScrollArea` component by default only shows vertical scrolling.
- **Fix**: Ensure the `ScrollArea` has `orientation="both"` or wrap with `overflow-x-auto` div so horizontal scroll works on touch devices.

**Issue 3: AIExtractView — 1400px fixed min-width table**
- File: `src/components/office/AIExtractView.tsx`
- Same pattern: `min-w-[1400px]` inside a `ScrollArea` — needs horizontal scrolling enabled for mobile/tablet.

### MODERATE — Layout/UX Issues

**Issue 4: Sidebar group labels clipped at collapsed width**
- File: `src/components/layout/AppSidebar.tsx`
- Group labels ("PRODUCTION", "LOGISTICS", "QA", "SYSTEM") render at collapsed `w-14` with `whitespace-nowrap` and `overflow-hidden`. They are partially visible (showing "PRODUCT", "LOGISTIC") which looks broken.
- **Fix**: Hide labels entirely when sidebar is collapsed using `opacity-0 group-hover/sidebar:opacity-100` (same pattern used for nav item labels), or use `invisible` at collapsed state.

**Issue 5: Duplicate "Admin" entry in MobileNavV2**
- File: `src/components/layout/MobileNavV2.tsx` lines 30-31
- The "Admin" menu item is listed twice in the `moreItems` array.
- **Fix**: Remove the duplicate line.

**Issue 6: Home page `pb-20` + AppLayout `pb-14` double bottom padding on mobile**
- Files: `src/pages/Home.tsx` line 152 and `src/components/layout/AppLayout.tsx` line 31
- `AppLayout` adds `pb-14` to `<main>` for mobile nav clearance. `Home.tsx` also adds `pb-20 md:pb-0`. Combined = 56px+80px = 136px wasted space on mobile at bottom of home page.
- **Fix**: Remove `pb-20 md:pb-0` from Home.tsx since AppLayout already handles this globally.

### MINOR — Cosmetic

**Issue 7: OfficeSidebar fixed `w-[180px]` doesn't collapse on tablet**
- File: `src/components/office/OfficeSidebar.tsx`
- Unlike the main `AppSidebar` which is hidden on mobile (`hidden md:flex`), the `OfficeSidebar` is always 180px wide. On tablet-sized screens (768-1024px), it consumes significant horizontal space.
- **Fix**: Add responsive collapsing behavior or hide behind a toggle on smaller screens, consistent with the main sidebar pattern.

**Issue 8: Accounting payroll journal entry grid can overflow**
- File: `src/components/accounting/AccountingPayroll.tsx`
- Uses `grid-cols-[1fr_100px_100px_auto]` which works on desktop but can compress on mobile.
- **Fix**: Stack vertically on small screens.

---

## Implementation Plan

### Step 1 — Fix critical overflow tables (Issues 1, 2, 3)
- Wrap PayrollOverviewTab table in `<div className="overflow-x-auto">` 
- Ensure DetailedListView and AIExtractView ScrollAreas support horizontal scrolling
- These 3 fixes prevent content from being clipped/invisible on mobile and tablet

### Step 2 — Remove duplicate Admin nav item (Issue 5)
- Delete duplicate line 31 in MobileNavV2.tsx

### Step 3 — Fix sidebar label clipping (Issue 4)
- Add `opacity-0 group-hover/sidebar:opacity-100 transition-opacity` to the group label `<span>` in AppSidebar.tsx so labels are hidden when collapsed and shown on hover

### Step 4 — Fix double bottom padding (Issue 6)
- Remove `pb-20 md:pb-0` from Home.tsx container div since AppLayout already handles mobile nav clearance

### Step 5 — OfficeSidebar tablet responsiveness (Issue 7)
- Add `hidden md:flex` pattern to OfficeSidebar, with a mobile toggle button, matching the main sidebar behavior

### Step 6 — Accounting grid stacking (Issue 8)
- Make the journal entry grid responsive: stack on mobile, grid on desktop

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/office/payroll/PayrollOverviewTab.tsx` | Wrap table in `overflow-x-auto` container |
| `src/components/office/DetailedListView.tsx` | Add horizontal scroll support |
| `src/components/office/AIExtractView.tsx` | Add horizontal scroll support |
| `src/components/layout/MobileNavV2.tsx` | Remove duplicate Admin entry (line 31) |
| `src/components/layout/AppSidebar.tsx` | Hide group labels when collapsed |
| `src/pages/Home.tsx` | Remove redundant `pb-20` padding |
| `src/components/office/OfficeSidebar.tsx` | Add responsive collapse for tablet |
| `src/components/accounting/AccountingPayroll.tsx` | Stack journal grid on mobile |

