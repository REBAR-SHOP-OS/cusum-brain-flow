
# Replace Josh Anderson with Saurabh + Smart Search Everywhere

## Part 1: Replace Josh Anderson with Saurabh Seghal

Josh Anderson no longer works at Rebar. 466 leads in the database currently have `metadata->>'odoo_salesperson' = 'Josh Anderson'` which needs to be updated to `Saurabh Seghal`.

### Data Operation
Update leads table metadata to replace the salesperson name:
```sql
UPDATE leads
SET metadata = jsonb_set(metadata::jsonb, '{odoo_salesperson}', '"Saurabh Seghal"')
WHERE metadata->>'odoo_salesperson' = 'Josh Anderson';
```

This also needs to be reflected in the Odoo sync so future syncs don't revert it. The Odoo-side reassignment should happen in Odoo itself -- this ERP fix handles the mirror.

---

## Part 2: Smart Search on All Pages

Currently only the Pipeline page has smart search with natural language parsing and hints. The following pages also have search boxes that should be upgraded:

| Page | Current search | Smart hints to add |
|---|---|---|
| **Customers** | Text match on name/company | "recent", "today", "this week", company type keywords |
| **Phone Calls** | Text match | "missed", "today", "this week", "inbound", "outbound", direction/result filters |
| **Prospecting** | Text match | "today", "this week", "hot", status keywords |
| **Brain (Knowledge)** | Text match | "today", "this week", category/tag keywords |
| **Social Media** | Text match | "scheduled", "published", "draft", "today", "this week" |
| **Packing Slips** | Text match on project/mark | "today", project keywords |
| **Chat History** | Text match on title/agent | Agent name keywords |
| **Inbox** | Text match | "unread", "today", sender keywords |

### Approach: Shared `SmartSearchInput` Component

Rather than duplicating the parser logic into every page, create a reusable component:

1. **New file: `src/components/ui/SmartSearchInput.tsx`**
   - Wraps the Input with sparkle icon, focus-based hint dropdown
   - Accepts a `hints` prop (array of `{ category, suggestions }`) so each page provides context-specific hints
   - Accepts an `onParsedChange` callback returning `{ tokens: Record<string,string>, textQuery: string }`
   - Uses a generic parser that extracts date tokens ("today", "this week", etc.) and page-specific keyword tokens

2. **New file: `src/lib/genericSearchParser.ts`**
   - Shared date-parsing rules (today, this week, this month, etc.)
   - Accepts a `keywords` config map per page (e.g., `{ "missed": { field: "result", value: "Missed" } }`)
   - Returns parsed tokens + remaining text query

3. **Update each page** to:
   - Replace raw `<Input>` with `<SmartSearchInput>`
   - Pass page-specific hints and keyword config
   - Apply parsed tokens as filters (client-side or query-side depending on page)

### Per-Page Smart Keywords

**Customers**: `"recent"` (sort by last activity), `"no email"` (filter missing email)

**Phone Calls**: `"missed"`, `"inbound"`, `"outbound"`, `"today"`, `"this week"`, `"has recording"`

**Prospecting**: `"contacted"`, `"not contacted"`, `"today"`, `"this week"`

**Brain**: `"today"`, `"this week"`, category tags

**Social Media**: `"draft"`, `"scheduled"`, `"published"`, `"today"`, `"this week"`, platform names (`"instagram"`, `"linkedin"`)

**Packing Slips**: `"today"`, `"pending"`, `"shipped"`

**Chat History**: Agent names (`"vizzy"`, `"blitz"`, `"penny"`), `"today"`, `"this week"`

**Inbox**: `"unread"`, `"today"`, `"this week"`, type filters (`"email"`, `"call"`)

### Files to Create
- `src/lib/genericSearchParser.ts` -- shared parsing engine
- `src/components/ui/SmartSearchInput.tsx` -- reusable smart search component with hint dropdown

### Files to Modify
- `src/pages/Customers.tsx` -- swap Input for SmartSearchInput
- `src/pages/Phonecalls.tsx` -- swap Input for SmartSearchInput
- `src/pages/Prospecting.tsx` -- swap Input for SmartSearchInput
- `src/pages/Brain.tsx` -- swap Input for SmartSearchInput
- `src/pages/SocialMediaManager.tsx` -- swap Input for SmartSearchInput
- `src/components/office/PackingSlipsView.tsx` -- swap Input for SmartSearchInput
- `src/components/panels/HistoryPanel.tsx` -- swap Input for SmartSearchInput
- `src/components/inbox/UnifiedInboxList.tsx` -- swap Input for SmartSearchInput
- `src/components/pipeline/PipelineFilters.tsx` -- refactor to use shared SmartSearchInput (keeping existing pipeline-specific parser)

## Technical Details

### Generic Parser Design

```typescript
interface KeywordRule {
  pattern: RegExp;
  key: string;
  value: string;
}

interface GenericSearchConfig {
  keywords?: KeywordRule[];
  enableDateParsing?: boolean; // default true
}

function parseGenericSearch(input: string, config: GenericSearchConfig): {
  tokens: Record<string, string>;
  textQuery: string;
}
```

Date parsing (shared across all pages): "today", "this week", "this month", "this quarter", "last 7 days", "last 30 days" -- extracted as `{ date: "today" }` token.

Page-specific keywords are passed via config. Each page interprets the returned tokens to apply its own filtering logic.

### SmartSearchInput Component

```typescript
interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hints: Array<{ category: string; suggestions: string[] }>;
  className?: string;
}
```

Renders: sparkle icon + input + floating hint dropdown on focus. Clicking a suggestion appends it to the input. Same UX pattern as the existing pipeline SearchHints but reusable.
