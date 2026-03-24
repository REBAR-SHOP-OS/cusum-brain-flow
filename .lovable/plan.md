

## Add Unified Contact List Autocomplete to New Sales Lead Dialog

### What
Replace the plain "Contact Name" text input in the New Sales Lead dialog with an autocomplete/combobox that searches the unified contact list (from `useSalesContacts` hook). When a contact is selected, auto-fill Company, Email, and Phone fields.

### Changes

**File**: `src/pages/sales/SalesPipeline.tsx`

1. Import `useSalesContacts` hook, plus `Popover`, `PopoverTrigger`, `PopoverContent` from UI, and `Command`/`CommandInput`/`CommandList`/`CommandItem`/`CommandEmpty` from UI.

2. Add state for contact popover open/closed and search text.

3. Replace the Contact Name `<Input>` (line 173) with a Popover+Command combobox:
   - Shows a searchable dropdown of contacts from `useSalesContacts()`
   - Filters by name, company, or email as user types
   - On select: auto-fills `contact_name`, `contact_company`, `contact_email`, `contact_phone` in the form
   - Still allows free-text typing (user can type a name not in the list)

4. The contact list merges system contacts (from `contacts` table) and manual sales contacts — already handled by the hook.

### Files Changed

| File | Change |
|---|---|
| `src/pages/sales/SalesPipeline.tsx` | Replace Contact Name input with searchable combobox using unified contact list |

