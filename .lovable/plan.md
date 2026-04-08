

# Change Ben's Primary Agent to Gauge

## Change

### `src/lib/userAccessConfig.ts` (lines 128–129)

Update `primaryAgent` from `"sales"` to `"estimating"` and `heroText` to reference **Gauge**:

```typescript
primaryAgent: "estimating",
heroText: "How can **Gauge** help you today?",
```

Also reorder `quickActions` so the estimating action comes first (line 130–134):

```typescript
quickActions: [
  { title: "Open takeoffs", prompt: "Show me all open takeoff sessions and their status — pending reviews, QC flags, and deadlines.", icon: "FileText", category: "Estimating" },
  { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
  { title: "Customer inquiry", prompt: "Show me recent customer inquiries and support tickets that need attention.", icon: "HeadphonesIcon", category: "Customer Care" },
  { title: "Prioritize my tasks", prompt: "Help me organize my tasks using the Eisenhower Matrix — what's urgent vs important right now?", icon: "LayoutGrid", category: "Eisenhower" },
],
```

| File | Change |
|------|--------|
| `src/lib/userAccessConfig.ts` | Set primaryAgent to "estimating", update heroText to Gauge, reorder quickActions |

