

# Deduplicate Video History Cards

## Problem
Multiple project cards with similar/identical names appear in "Your Previous Videos" because each pipeline run creates a new database row instead of updating the existing one. The user wants only one card per prompt.

## Root Cause
In `backgroundAdDirectorService.ts` line 377, `saveProject` is called with `id: this.state.projectId ?? undefined`. When `projectId` is null/undefined (e.g., on a fresh generation), a new row is inserted. Repeated generations with the same or similar prompts create duplicate rows.

## Solution — Two-part fix

### 1. Deduplicate display in `VideoHistory.tsx`
Group visible projects by their `script` (original prompt text) or `name`, keeping only the most recent one per group. This handles existing duplicates immediately.

```typescript
// After filtering visible projects, deduplicate by script/name
const deduped = Object.values(
  visible.reduce((acc, p) => {
    const key = p.script || p.name || p.id;
    if (!acc[key] || new Date(p.updated_at) > new Date(acc[key].updated_at)) {
      acc[key] = p;
    }
    return acc;
  }, {} as Record<string, AdProjectRow>)
);
```

### 2. Prevent future duplicates at the source in `backgroundAdDirectorService.ts`
Before creating a new project, check if a project with the same prompt already exists and reuse its ID for an update instead of an insert.

In `startPipeline` (around line 376), before calling `saveProject`, query for an existing project with matching `script`:
- If found, set `this.state.projectId = existingProject.id` so the save becomes an update
- If not found, proceed as normal (insert)

## Files Changed
- `src/components/ad-director/VideoHistory.tsx` — deduplicate visible projects by script/name
- `src/lib/backgroundAdDirectorService.ts` — reuse existing project ID when prompt matches

