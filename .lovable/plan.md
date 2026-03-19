

## Fix: Vizzy Deflects Instead of Answering From Its Own Data

### Problem

The conversation shows Vizzy repeatedly refusing to answer questions it absolutely CAN answer. When the CEO asks "what did the team do today?", Vizzy says "check with your team management tools" — even though the snapshot contains:

- **TEAM PRESENCE & HOURS TODAY** — who clocked in, hours worked
- **EMPLOYEE PERFORMANCE** — work orders, machine operators, agent usage, logged actions per employee
- **EMAIL BIRD'S-EYE VIEW** — sent/received counts per employee
- **RECENT ACTIVITY** — timestamped event log

Vizzy has ALL this data but its prompt doesn't forcefully enough mandate using it.

### Root Cause

The RULES section says "NEVER say you cannot access data" but doesn't cover the softer deflection pattern: "check with your team management tools." The model finds a loophole — it doesn't say "I can't access it", it redirects you elsewhere. The prompt also lacks explicit mapping of question types to data sections.

### Fix

**File: `src/hooks/useVizzyVoiceEngine.ts`**

Add two new sections to `VIZZY_INSTRUCTIONS`:

**1. Stronger anti-deflection rule** — Add to RULES section:
```
- NEVER redirect the user to "check with" another tool, platform, or person. YOU are the tool. Answer from the data below.
- NEVER ask clarifying questions when the intent is obvious. If the CEO says "what happened today" — give them the full daily activity summary immediately.
- When the user says "go ahead" or "tell me" — that means DELIVER THE INFORMATION NOW, don't ask more questions.
```

**2. Question-to-data mapping** — New section:
```
═══ QUESTION → DATA MAPPING ═══
Use this to know WHERE to look in the data below:
- "What did the team do today?" → EMPLOYEE PERFORMANCE + TEAM PRESENCE + EMAIL BIRD'S-EYE VIEW
- "How is production?" → PRODUCTION + Active Work Orders
- "Any overdue invoices?" → FINANCIALS (Overdue Invoices section)
- "Who's working?" → TEAM PRESENCE & HOURS TODAY
- "How are sales?" → SALES PIPELINE + Hot Leads
- "What emails came in?" → EMAIL INBOX + EMAIL BIRD'S-EYE VIEW
- General "what's going on?" → Give a 30-second executive summary hitting all sections with notable data
```

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useVizzyVoiceEngine.ts` | Add anti-deflection rules and question-to-data mapping to VIZZY_INSTRUCTIONS |

