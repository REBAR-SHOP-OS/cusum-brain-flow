

# Add Company Name and Remark to Ref Section on Rebar Tag

## What Changes

The Ref section on the tag will show three lines:
1. **Ref:** `reference || "—"`
2. **Company:** `customer || "—"` (from `extract_rows.customer`)
3. **Remark:** `address || "—"` (repurposing the existing `address` field)

## File Changes

### `src/components/office/RebarTagCard.tsx`
- Rename prop `address` to `remark` in `RebarTagCardProps` (or keep `address` internally and label it "Remark" in the UI)
- Update the Ref section (lines 161-168) to show three compact lines:
  - `Ref: {reference || "—"}`
  - `Company: {customer || "—"}`  
  - `Remark: {address || ""}`  (only shown if non-empty)
- Reduce text size slightly to fit all three lines in the same space

### `src/pages/PrintTags.tsx`
- No change needed — already passes `customer` and `address` props

### `src/utils/generateZpl.ts`
- Add a `customer` field to `ZplRowData` interface
- Update ZPL output to include `COMPANY:` and `REMARK:` lines alongside `REF:`

