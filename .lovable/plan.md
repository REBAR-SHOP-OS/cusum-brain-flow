

## Plan: Interactive Packing Slip Signatures

### Overview
Upgrade the DriverDropoff packing slip to support rich signature capture with draw/type/upload modes, timestamps, auto-completion logic, and print/PDF actions.

### New Component: `src/components/delivery/SignatureModal.tsx`
A reusable modal with 3 tabs:
- **Draw** — Reuses existing `SignaturePad` canvas (mobile-friendly, full-width)
- **Type** — Text input rendered in a cursive font preview (e.g., `font-family: 'Brush Script MT', cursive`)
- **Upload** — File input accepting PNG/JPG with image preview

Returns a base64 data URL on save regardless of mode. Props: `open`, `onOpenChange`, `onSave(dataUrl: string)`, `title: string`.

### Changes to `src/pages/DriverDropoff.tsx`

1. **Replace inline SignaturePads** with clickable signature areas:
   - Empty state: dashed border box with "Tap to Sign" + pen icon
   - Signed state: rendered signature image + green check + timestamp
   - Clicking opens `SignatureModal`

2. **Store timestamps** alongside signature data:
   - `driverSignedAt: Date | null`
   - `customerSignedAt: Date | null`
   - Display formatted timestamp below each signature

3. **Auto-completion logic**: When both signatures + photo + all items checked → auto-enable submit (already partly exists via `canSubmit`)

4. **Add action buttons** below the document:
   - **Print** — `window.print()` with print-specific CSS
   - **Download PDF** — Use `html2canvas` (already installed) to capture the slip div and trigger download
   - **Send to Customer** — Placeholder button (toast "Coming soon" for now, since email integration is separate)

5. **Persist signature metadata** on submit:
   - Driver signature path → `delivery_stops.notes` (existing pattern: `driver_signature:path`)
   - Customer signature path → `delivery_stops.pod_signature` (existing)
   - Both timestamps persisted in notes field as JSON: `{"driver_sig":"path","driver_signed_at":"ISO","customer_signed_at":"ISO"}`

### Changes to `src/components/shopfloor/SignaturePad.tsx`
- Already fixed stroke color to `#000000` — no further changes needed

### Print CSS
Add `@media print` rules to `src/index.css`:
- Hide header nav, bottom CTA bar, action buttons
- Show only the packing slip document at full width
- Render signature images inline (already base64)

### Technical Notes
- `html2canvas` is already in dependencies — will use it for PDF generation via canvas → blob → download
- No DB schema changes needed — reusing existing `pod_signature`, `pod_photo_url`, `notes` columns
- The `SignatureModal` component will be ~120 lines, using existing Dialog + Tabs UI primitives
- Type-signature renders text on a hidden canvas to produce consistent data URL output

