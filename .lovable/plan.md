

# Add Company Rules Icon to Vizzy Brain Panel

## What
Add a "Company Rules" button (📋 icon) to the Vizzy Brain header bar. Clicking it opens a dialog where the CEO can write/edit company employee rules and policies. These rules are saved to the existing `knowledge` table with a dedicated category (`company-rules`), so Vizzy automatically picks them up via `brainKnowledge` context.

## How

### 1. Create `CompanyRulesDialog.tsx`
- New component: `src/components/vizzy/CompanyRulesDialog.tsx`
- On open: fetch existing `knowledge` entry where `category = 'company-rules'` and `company_id` matches
- Shows a large `Textarea` for the CEO to write/edit all company rules (employee policies, attendance, conduct, etc.)
- Save button upserts a single `knowledge` row with `title: "Company Rules & Policies"`, `category: "company-rules"`, and the full text as `content`
- Uses existing `knowledge` table — no DB migration needed

### 2. Update `VizzyBrainPanel.tsx`
- Add a `ScrollText` (or `Scale`) icon button next to "Analyze Now" in the header bar
- Tooltip: "Company Rules"
- Opens the new `CompanyRulesDialog`
- Import and render the dialog with open/close state

### 3. Vizzy auto-learns
- The `vizzy-context` edge function already fetches all `knowledge` rows as `brainKnowledge`
- The `agentContext.ts` already builds `brainKnowledgeBlock` from knowledge entries
- No backend changes needed — rules will automatically appear in Vizzy's context

## Scope
- 1 new file: `CompanyRulesDialog.tsx`
- 1 modified file: `VizzyBrainPanel.tsx` (add icon + dialog)
- No database changes, no edge function changes

