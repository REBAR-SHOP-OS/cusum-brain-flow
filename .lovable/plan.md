

# Build AI Visibility Audit into App + Auto-Generate SEO Tasks

## Overview
Mirror the Local SEO module pattern: replace the freeform text audit in `SeoAiVisibility.tsx` with structured, interactive category cards and auto-generate SEO tasks from high-priority findings.

## Changes

### 1. New Edge Function: `supabase/functions/seo-ai-visibility-audit/index.ts`
Same pattern as `seo-local-audit`. Uses tool calling to return structured JSON with 4 categories:
- **AI Platform Visibility** (ChatGPT, Google AI, Perplexity likelihood scores)
- **Content Gaps** (missing informational content, FAQs, guides)
- **Schema Markup** (Organization, Product, Service, FAQPage recommendations)
- **Action Items** (5 specific actions to improve AI visibility)

Each category has checklist items with `title`, `description`, `priority`, `is_task`, `expected_impact`. High/critical items auto-insert into `seo_tasks` with `task_type: "ai_visibility"`.

### 2. Rebuild `src/components/seo/SeoAiVisibility.tsx`
Replace raw text display with the same interactive UI as `SeoLocal.tsx`:
- 4 stat cards (Total Items, Completed, Tasks Created, High Priority)
- Run Audit button calling the new edge function
- Collapsible category cards with checkboxes, priority badges, task indicators
- Toast notification when tasks are auto-generated

### 3. Add `ai_visibility` task type to `src/components/seo/SeoTasks.tsx`
Add to `taskTypeColors`:
```typescript
ai_visibility: "bg-violet-500/10 text-violet-600",
```

## Files Changed
- `supabase/functions/seo-ai-visibility-audit/index.ts` — new edge function
- `src/components/seo/SeoAiVisibility.tsx` — rebuild with interactive checklist UI
- `src/components/seo/SeoTasks.tsx` — add `ai_visibility` task type color

