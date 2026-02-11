

## Reduce Automation Card Size

### Change
**File: `src/components/integrations/AutomationsSection.tsx`**

- Reduce card padding from `p-5` to `p-4`
- Display the automation name on a single line instead of splitting each word onto its own `<span className="block">` -- remove the `.split(" ").map(...)` logic and render the name as a single `<h3>`
- Reduce title font size from `text-xl` to `text-lg`
- Reduce decorative icon size from `w-24 h-24` to `w-16 h-16`
- Reduce bottom margin on description from `mb-4` to `mb-3`

These are purely cosmetic tweaks to the existing component -- no logic or functionality changes.

