

## Add Drag-and-Drop Estimation Zone to Sales Quotations Page

### What
Add a file drop zone to the Quotations page. When estimation PDF/drawings are dropped, it opens the TakeoffWizard (same one used in Estimation page), runs the AI takeoff, and auto-creates a quotation with auto-generated Q-number.

### Changes

**1. `src/pages/sales/SalesQuotations.tsx`**
- Import `TakeoffWizard` from estimation components
- Add drag-and-drop event handlers (`onDragOver`, `onDragLeave`, `onDrop`) on the empty state area
- When files are dropped, open the TakeoffWizard with a visual drop zone highlight
- Pass dropped files into the wizard flow
- On wizard complete, refresh quotations list
- Add a visual drop zone indicator (dashed border, Upload icon, "Drop estimation files here to auto-generate quotation")

**2. `src/components/estimation/TakeoffWizard.tsx`**
- Add optional `initialFiles?: File[]` prop
- When `initialFiles` is provided, auto-upload them on open and skip to step 2 (project naming)
- This avoids duplicating the entire takeoff logic

### UI Flow
1. User sees empty quotations page with drop zone: "Drop estimation drawings here to auto-generate a quotation"
2. User drags PDF files onto the zone → visual highlight
3. TakeoffWizard opens with files pre-loaded
4. User names project, selects customer → AI runs takeoff
5. On complete: quotation auto-created (existing logic) + wizard closes + list refreshes

### Drop Zone Design
- Dashed border area within the empty state
- Upload icon + "Drop estimation files to create quotation"
- Blue highlight on drag-over
- Also show the drop zone alongside the table when quotations exist (smaller, at top)

