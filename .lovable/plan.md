

# Office Portal Audit & Improvements

## Issues Found

### Critical Bugs

1. **Mobile sidebar is invisible** -- `OfficeSidebar` wraps everything in `<aside className="hidden md:flex ...">`, which means when rendered inside the mobile `Sheet`, the content is still hidden. The mobile hamburger menu opens an empty panel.

2. **AI Transcribe missing from sidebar navigation** -- The `officeTools` array in `OfficeSidebar.tsx` does not include `"ai-transcribe"`. Users can only reach it via direct URL state, not by clicking the sidebar.

3. **Payroll Audit missing from sidebar** -- A fully-built `PayrollAuditView` exists with Ontario compliance, weekly snapshots, and approval workflows, but it has no sidebar entry and no route mapping in the Office Portal.

### Code Quality Issues

4. **Duplicate import in OfficePortal.tsx** -- `AIExtractView` is imported twice (once as `FallbackView`, once as itself). The `"ceo-dashboard"` section maps to `FallbackView` which is just `AIExtractView` again -- misleading.

5. **Dead code in sidebar** -- `bottomItems` is an empty array that renders nothing. Several unused icon imports (`Activity`, `Terminal`, `Users`, `LayoutGrid`, `DollarSign`).

### Data Issues

6. **Packing Slips uses hardcoded mock data** -- `PackingSlipsView` has hardcoded `companyVaults` and `archivedDocs` arrays instead of querying real delivery/packing data from the database.

---

## Plan

### 1. Fix Mobile Sidebar Bug

Remove `hidden md:flex` from the `<aside>` inside `OfficeSidebar`. The parent in `OfficePortal.tsx` already controls visibility with `hidden md:flex` on the desktop wrapper and `Sheet` for mobile. The sidebar component itself should always render.

### 2. Add Missing Sidebar Sections

Add these entries to the `officeTools` array in `OfficeSidebar.tsx`:

| Section | Label | Icon | Position |
|---------|-------|------|----------|
| `ai-transcribe` | AI Transcribe | Languages | After AI Extract |
| `payroll` | Payroll | DollarSign | After Packing Slips |

### 3. Register Payroll in the Portal

- Add `"payroll"` to the `OfficeSection` type union
- Add `PayrollAuditView` to the `sectionComponents` map in `OfficePortal.tsx`
- Import `PayrollAuditView`

### 4. Clean Up Dead Code

- Remove the duplicate `AIExtractView as FallbackView` import
- Remove `"ceo-dashboard"` from `sectionComponents` (it redirects to `ai-extract` anyway via the `initialSection` logic)
- Remove the empty `bottomItems` array and its rendering block
- Remove unused icon imports from `OfficeSidebar.tsx`

### 5. Connect Packing Slips to Real Data

Replace mock arrays with queries to the `deliveries` and `delivery_stops` tables (or `cut_plans`/`work_orders` with completed status). Show actual finalized packing slips from the database with real customer names, dates, and delivery methods.

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/components/office/OfficeSidebar.tsx` | Remove `hidden md:flex` from aside, add `ai-transcribe` and `payroll` to officeTools, clean unused imports/dead code |
| `src/pages/OfficePortal.tsx` | Remove duplicate import, add payroll to section map, remove ceo-dashboard mapping, import PayrollAuditView |
| `src/components/office/PackingSlipsView.tsx` | Replace mock data with database queries to deliveries/delivery_stops, show real archived packing slips |

### No New Files Required

All components already exist. This is purely a wiring and data connection fix.

