

# Add Calendar Picker for Ship Date

## Problem
The "Ship Date" field in the Quotation Editor (`DraftQuotationEditor.tsx`) uses a plain `<Input type="date">` which shows the raw `yyyy-mm-dd` placeholder. User wants a proper calendar date picker.

## Fix
Replace the `<Input type="date">` at line 458-461 with a Shadcn `Popover` + `Calendar` component (date picker pattern).

### Changes needed:
1. **Add imports**: `Calendar` from `@/components/ui/calendar`, `CalendarIcon` from `lucide-react`, `format` from `date-fns`, `cn` from `@/lib/utils`
2. **Add state**: `shipDate` as `Date | undefined`
3. **Replace Input** (lines 456-462): Swap `<Input type="date">` with `Popover > PopoverTrigger (Button) > PopoverContent > Calendar` using the standard Shadcn datepicker pattern with `pointer-events-auto`

## File Changed
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — replace ship date input with calendar picker

