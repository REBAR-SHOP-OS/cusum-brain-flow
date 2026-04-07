

# Make Quotation Editor Buttons White

## Problem
The "Add Line" button, "Upload" button, and "Ship Date" picker appear as dark/black buttons against the white quotation form, making them hard to read.

## Root Cause
These buttons use `variant="outline"` but lack explicit white background classes. The quotation editor forces white backgrounds via `inputCls` on inputs, but the buttons don't get the same treatment.

## Changes

### 1. `src/components/accounting/documents/DraftQuotationEditor.tsx`

**Ship Date button** (line 563): Add `bg-white text-gray-900 border-gray-300 hover:bg-gray-50` to the className so it matches the white form.

**Add Line button** (line 713): Add `bg-white text-gray-900 border-gray-300 hover:bg-gray-50` classes.

### 2. `src/components/accounting/DocumentAttachments.tsx`

**Upload button** (line 131): Add `bg-white text-gray-900 border-gray-300 hover:bg-gray-50` classes to match the white quotation form context.

## Summary
3 buttons updated across 2 files — all get explicit white styling to match the quotation form's white theme.

