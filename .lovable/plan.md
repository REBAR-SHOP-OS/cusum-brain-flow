

## Rename "CEO Command" to "CEO Portal"

**WHAT:** Replace all instances of "CEO Command" with "CEO Portal" across 3 files.

**WHERE / CHANGES:**

| File | Line | Before | After |
|------|------|--------|-------|
| `src/pages/Home.tsx` | 201 | `"CEO Command"` | `"CEO Portal"` |
| `src/lib/userAgentMap.ts` | 14 | `**CEO Command**` | `**CEO Portal**` |
| `src/lib/userAgentMap.ts` | 36 | `**CEO Command**` | `**CEO Portal**` |
| `supabase/functions/ai-agent/index.ts` | 1075 | `**CEO Command Center**` | `**CEO Portal**` |

**RESULT:** All user-facing references updated from "CEO Command" to "CEO Portal". No logic, layout, or routing changes.

