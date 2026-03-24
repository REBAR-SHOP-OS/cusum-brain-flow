

## Replace "Assigned To" Text Input with Team Member Dropdown

### What
Change the "Assigned To" field from a plain text input to a `Select` dropdown populated with team members from `useProfiles()` in both the main Pipeline and Sales Pipeline forms.

### Changes

**File**: `src/components/pipeline/LeadFormModal.tsx`
- Import `useProfiles` hook
- Replace the `<Input>` for `assigned_to` (line 369) with a `<Select>` dropdown
- Populate options with `profiles` (filtered to active), showing `full_name`
- Store profile `id` as the value

**File**: `src/pages/sales/SalesPipeline.tsx`
- Import `useProfiles` hook
- Replace the `<Input>` for `assigned_to` (line 379) with a `<Select>` dropdown
- Same pattern: list active profiles by `full_name`, store `id`

### Files Changed

| File | Change |
|---|---|
| `src/components/pipeline/LeadFormModal.tsx` | Replace Assigned To input with profiles dropdown |
| `src/pages/sales/SalesPipeline.tsx` | Replace Assigned To input with profiles dropdown |

