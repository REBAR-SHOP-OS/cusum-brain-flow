

# Generate AI-Written Narrative Report for User Actions

## Goal
Replace the current structured clipboard copy with an AI-generated narrative report that describes what the user actually did with each agent — a readable text summary of their interactions and system activity.

## Approach
When clicked, the button will:
1. Gather all existing data (performance stats, agent sessions with recent messages, activity log)
2. Send this data to Lovable AI (via the existing `ai-agent` edge function or a lightweight dedicated edge function) to produce a human-readable narrative
3. Display the generated report in a dialog/modal so the user can read and optionally copy it

## Changes

### 1. Update `UserFullReportButton` in `VizzyBrainPanel.tsx`
- Add loading state for AI generation
- On click: aggregate all data (same as now), then call the AI to write a narrative summary
- Show result in a `Dialog` with scrollable text + copy button
- Use `invokeEdgeFunction("ai-agent", ...)` with a dedicated prompt that instructs the AI to write a comprehensive report from the raw data
- The prompt will include: user name, performance stats, agent session details (names, session counts, message previews), and activity log entries
- AI model: `google/gemini-2.5-flash` (fast, good for summarization)

### 2. AI Prompt Design
The system prompt will instruct the model to:
- Write in professional tone
- Summarize what the user accomplished with each agent
- Highlight key metrics (hours, sessions, activities)
- Note any patterns or notable items from the activity log
- Keep it concise (1-2 paragraphs per section)

## File Changes

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Rewrite `UserFullReportButton` to call AI and show narrative in a Dialog |

## Technical Notes
- Reuses existing `invokeEdgeFunction` + `ai-agent` edge function — no new backend code
- The `recentMessages` from `useUserAgentSessions` provides conversation context for the AI to summarize
- Dialog uses existing shadcn `Dialog` components
- Fallback: if AI call fails, show the raw structured report (current behavior)

