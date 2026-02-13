

# Intelligent Pipeline Search Box

## Problem

The search box currently does plain text matching against lead titles, descriptions, sources, notes, and customer names. Typing "today" returns 0 results because no lead contains the word "today" in its text fields. Users expect natural language queries like "today", "won", "hot leads", "stale", "Torpave", or "value > 50k" to just work.

## Solution

Add a **client-side smart query parser** that intercepts known natural language patterns and converts them into filter state + text search, before the debounced query fires. No AI API call needed -- this is instant, deterministic parsing.

### Supported Queries (examples)

| User types | Parsed as |
|---|---|
| `today` | Filter: creationDateRange = "today" |
| `this week` / `this month` | Filter: creationDateRange = "this_week" / "this_month" |
| `won` / `lost` | Filter: won = true / lost = true |
| `hot` / `hot leads` | Text search for leads in "hot_enquiries" stage |
| `stale` / `inactive` | Filter: leads not updated in 7+ days |
| `unassigned` | Filter: unassigned = true |
| `value > 50000` / `over 100k` | Client filter on expected_revenue |
| `Torpave` | Falls through to normal text search (no pattern match) |
| `new today` | Stage = "new" AND creationDateRange = "today" |
| `won this month` | won = true AND creationDateRange = "this_month" |

### How It Works

```text
User input --> Smart Parser --> { filters: PipelineFilterState, textQuery: string }
                                    |                              |
                            Applied to filter state        Sent to debounced search
```

1. Parser runs synchronously on every keystroke (lightweight regex matching)
2. Recognized tokens are extracted and converted to filter mutations
3. Remaining unrecognized text becomes the standard text search query
4. Visual feedback: recognized tokens appear as filter chips in the search bar (already supported)

## Changes

### 1. New utility: `src/lib/smartSearchParser.ts`

A pure function that takes a search string and returns:
```typescript
interface SmartSearchResult {
  filters: Partial<PipelineFilterState>;
  textQuery: string;           // leftover text for DB search
  staleThresholdDays?: number; // for client-side "stale" filtering
  revenueFilter?: { op: "gt" | "lt" | "eq"; value: number };
  stageFilter?: string;       // direct stage id match
}
```

Pattern matching rules (processed in order, tokens removed after match):
- **Date patterns**: "today", "this week", "this month", "this quarter", "this year", "last 7 days", "last 30 days"
- **Status patterns**: "won", "lost", "open", "archived"
- **Assignment**: "unassigned", "my pipeline", "my leads"
- **Stage names**: Any exact or fuzzy match to PIPELINE_STAGES labels (e.g., "hot" matches "Hot Enquiries", "proposal" matches "Proposal")
- **Stale/activity**: "stale", "inactive", "no activity", "stuck" (triggers 7-day threshold)
- **Revenue**: "value > N", "over Nk", "above N", "under N", "below Nk"
- **Combinators**: Multiple tokens can coexist ("won this month", "hot unassigned")

### 2. Update `PipelineFilters.tsx`

- Show a subtle "sparkle" icon or hint text in the search placeholder indicating smart search capability
- When smart parser returns filters, display them as removable chips (already works)
- Add a small tooltip/hint dropdown below the search showing recognized commands as user types (optional autocomplete)

### 3. Update `Pipeline.tsx`

- Import and call `parseSmartSearch(searchQuery)` in the debounce effect
- Apply returned filters to `pipelineFilters` state
- Apply `textQuery` to `debouncedSearch` (only the non-filter text goes to the DB)
- Apply `staleThresholdDays` and `revenueFilter` as additional client-side filters in `filteredLeads` memo
- Apply `stageFilter` as an additional filter

### 4. Search hint dropdown (new component): `src/components/pipeline/SearchHints.tsx`

A small floating dropdown that appears when the search box is focused, showing:
- Recently used smart queries
- Quick suggestions based on current input (e.g., typing "t" shows "today", "this week", "this month")
- This makes discoverability easy without documentation

## Technical Details

### File: `src/lib/smartSearchParser.ts` (new)

Pure function, no side effects, fully testable. Uses regex patterns and string matching against PIPELINE_STAGES. Handles case insensitivity and partial matches.

### File: `src/components/pipeline/SearchHints.tsx` (new)

Small popover component anchored to the search input. Shows categorized suggestions (Date, Status, Stage, Revenue). Clicking a suggestion fills the search box.

### File: `src/components/pipeline/PipelineFilters.tsx` (modify)

- Update placeholder to "Search or type: today, won, hot, stale..."
- Add search hints dropdown trigger on focus
- Pass parsed smart filters up to parent

### File: `src/pages/Pipeline.tsx` (modify)

- Import `parseSmartSearch`
- In the debounce effect, parse the query and split into filters vs text
- Add stale/revenue client-side filters to `filteredLeads` memo
- Merge smart-parsed filters with manual filter panel filters (smart search overrides, manual panel can add more)
