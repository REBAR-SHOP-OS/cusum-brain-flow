

# Build Local SEO Audit into App + Auto-Generate SEO Tasks

## Overview
Transform the Local SEO module from a simple "run audit and display text" view into a structured, interactive module with checklist tracking and automatic task generation from audit findings.

## Approach

### 1. Restructure the AI audit prompt to return structured JSON
**File:** New edge function `supabase/functions/seo-local-audit/index.ts`

Instead of returning freeform text, the AI will return structured JSON with 5 categories, each containing checklist items with status, priority, and task-worthy recommendations:

```text
{
  categories: [
    { name: "Google Business Profile", items: [
      { title: "Set primary category to Steel Fabricator", priority: "high", description: "...", is_task: true },
      ...
    ]},
    { name: "Local Keywords", items: [...] },
    { name: "Review Management", items: [...] },
    { name: "Competitor Analysis", items: [...] },
    { name: "NAP Consistency", items: [...] }
  ]
}
```

Uses `ai-generic` with tool calling to enforce structured output. The function also auto-inserts items marked `is_task: true` into `seo_tasks` with `task_type: "local"` and `created_by: "ai"`.

### 2. Rebuild SeoLocal.tsx with interactive UI
**File:** `src/components/seo/SeoLocal.tsx`

Replace the raw text display with:
- **5 category cards** (GBP, Keywords, Reviews, Competitors, NAP) — each expandable with checklist items
- Each item shows: title, description, priority badge, and a checkbox for manual tracking
- A "Generate Tasks" button that sends selected high-priority items to `seo_tasks`
- The audit results are stored in component state (and optionally persisted via the edge function)
- Stats cards at top update to show: total items, completed items, tasks generated, high-priority count

### 3. Auto-generate seo_tasks from audit
**File:** `supabase/functions/seo-local-audit/index.ts`

After the AI returns structured results, the edge function:
- Filters items where `is_task: true` and `priority` is "high" or "critical"
- Inserts them into `seo_tasks` with `task_type: "local"`, `created_by: "ai"`, `status: "open"`
- Uses the existing `domain_id` and `company_id` from `seo_domains`
- Returns both the structured audit and the count of tasks created

### 4. Add "local" task type support
**File:** `src/components/seo/SeoTasks.tsx` — add `local` to `taskTypeColors`:
```typescript
local: "bg-orange-500/10 text-orange-600",
```

## Technical Details

- The edge function uses `handleRequest` + `callAI` from shared modules (same pattern as `seo-ai-strategy`)
- AI model: `gemini-2.5-flash` (fast, structured output)
- Tool calling enforces the JSON schema — no parsing issues
- Tasks are deduplicated by checking existing open tasks with similar titles before inserting
- The `seo_tasks` table already has all needed columns (`task_type`, `ai_reasoning`, `expected_impact`, `created_by`)

## Files Changed
- `supabase/functions/seo-local-audit/index.ts` — new edge function for structured local SEO audit + task generation
- `src/components/seo/SeoLocal.tsx` — rebuild with interactive checklist UI and task generation
- `src/components/seo/SeoTasks.tsx` — add "local" task type color

