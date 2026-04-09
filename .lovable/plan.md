

# Remove Agent Suggestions from Dashboard & Create Collection Task for Vicky

## Two Actions

### 1. Remove Agent Suggestions Panel from Home Dashboard
**File: `src/pages/Home.tsx`**, lines 272-275

Remove the entire `AgentSuggestionsPanel` block. The component itself stays in the codebase (it may be used elsewhere or re-enabled later), but it will no longer render on the home dashboard.

### 2. Create a Consolidated Collection Task for Vicky
**Database insert** — one task assigned to Vicky Anderson (`e82c7ca3-126f-4f88-a368-4774aa8d450e`) summarizing all 23 overdue invoice follow-ups:

```
Title: Follow up on all overdue AR invoices — Collections
Priority: High
Due: Today (April 9, 2026)
Description: Review and follow up on all overdue accounts receivable. Key accounts:
- The Clifford Group — $1,245 (2 invoices)
- Baryland Electric — $1,060 (106d overdue)
- Vegatech Construction — $166 (183d)
- Chris Morgis — $2,890 (3 invoices)
- Golden Home Renovations — $2,260 (195d)
- GLADIUS 7835 Inc — $49,532 (6 invoices)
- 1000558934 Ontario Inc — $46,134 (3 invoices)
- ET Construction — $2,700 (6d)
- NTL Contracting — $155 (3d)
- ZACK DURHAM — $236 (2d)
- BLUE HORIZON BUILDERS — $198 (168d)
- COSS CONSTRUCTION — $1 (92d)
- GTC-CANADA LTD — $0.01 (206d)
Contact each customer, determine payment status, and update collection notes.
```

## Files Modified
| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Remove AgentSuggestionsPanel from dashboard |
| Database (tasks table) | Insert one high-priority task for Vicky |

