

## Fix Blank Print on Delivery Terminal

The print output is blank because the global `@media print` CSS (in `src/index.css`) hides all page content with `body * { visibility: hidden !important }` and only reveals elements with `.rebar-tag` or `.driver-dropoff-print` classes. The Delivery Terminal doesn't use either class. Additionally, `@page` is locked to 4x6 inches (zebra label size).

### Changes

**1. `src/pages/DeliveryTerminal.tsx`**
- Add `driver-dropoff-print` class to the main content container (the `<div className="max-w-2xl ...">` at line 160)
- Add `print:hidden` class to the header bar, the photo/signature section, and the Confirm Delivery button — these shouldn't appear on the printed packing slip
- Keep only: customer name title, unloading site address, and the unloading checklist in the printable area
- Add a print-only header inside the `driver-dropoff-print` div showing customer name and "Packing Slip" title

**2. `src/index.css`**
- Wrap the existing zebra-label `@page { size: 4in 6in }` rule inside a more specific scope so it only applies when `.rebar-tag` is present
- Update the `@media print` block to:
  - Use default A4 page size for `.driver-dropoff-print`
  - Set white background and black text on printable content
  - Properly position and size the `.driver-dropoff-print` container
  - Hide interactive elements (buttons, signature pad, photo capture)

### Technical Detail

The `@media print` block currently sets a single `@page` size of 4x6. CSS `@page` cannot be conditionally scoped to a class, so the fix will remove the global `@page { size: 4in 6in }` and instead use named pages: `.rebar-tag` gets `page: zebra` with `@page zebra { size: 4in 6in }`, while `.driver-dropoff-print` gets `page: a4` with `@page a4 { size: A4; margin: 15mm }`. This allows both print formats to coexist.

