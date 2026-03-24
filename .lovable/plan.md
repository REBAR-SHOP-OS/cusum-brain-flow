

## Add Customer Signature Pad to Packing Slip

### What
Replace the static "Received By (Signature)" line on the Packing Slip with an interactive signature pad (reusing the existing `SignaturePad` component). The signature renders on screen for signing and prints as an image on the PDF. The "Delivered By" side stays as a static line for now.

### Changes

**File**: `src/components/accounting/documents/PackingSlipTemplate.tsx`

1. Import `SignaturePad` from `@/components/shopfloor/SignaturePad`
2. Add state: `receivedSignature` (string | null)
3. Replace the "Received By" empty line div with:
   - **On screen (print:hidden)**: Render `<SignaturePad>` for drawing
   - **For print (hidden on screen, print:block)**: Render `<img src={receivedSignature}>` if signed, or the empty line if not
4. Keep "Delivered By" as the static empty line (for manual pen signing)

### Technical Detail
- The `SignaturePad` component already handles touch/mouse drawing, clear button, and returns a base64 PNG data URL
- For print: the canvas element doesn't print well, so we render the captured data URL as an `<img>` tag with `print:block hidden` classes
- The signature pad will be styled to match the packing slip's black/white/gray aesthetic

### Files Changed

| File | Change |
|---|---|
| `src/components/accounting/documents/PackingSlipTemplate.tsx` | Add SignaturePad for "Received By" section with print-friendly image output |

