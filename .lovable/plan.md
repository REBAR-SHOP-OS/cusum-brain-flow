

## Add RingCentral Call Intelligence + Casual Sales Supervisor Personality

### What Changes

Two things: (1) Feed RingCentral call data into Vizzy's context so she can see every call per employee, and (2) upgrade her personality to be casual, proactive, and act like a human supervisor who reads everything and connects the dots.

### 1. Add RingCentral calls to `vizzyFullContext.ts`

Add a new query to the uncached parallel block for today's RingCentral calls:

```sql
communications WHERE source = 'ringcentral' AND received_at >= today
```

Then build two new sections in the output:

- **RINGCENTRAL CALLS TODAY** — Per-employee breakdown: calls made, received, missed, total talk time
- **CALL DETAILS** — Each call with direction, from/to, duration, result

This goes after the EMAIL BIRD'S-EYE VIEW section. The per-employee aggregation uses `metadata.type === 'call'` and matches `from_address`/`to_address` against profile emails + phone numbers.

### 2. Add RingCentral calls to `vizzy-context/index.ts`

Add the same RingCentral query to the snapshot builder so the lightweight context endpoint also includes call data.

### 3. Upgrade personality + add Sales Supervision in `useVizzyVoiceEngine.ts`

**Personality rewrite** — Make her casual and human:
- Talk like a trusted friend who's been running the business alongside the CEO for years
- Be direct, sometimes funny, always real. Skip corporate language entirely.
- When something's wrong, say it plainly. When something's great, get excited about it.
- Swear lightly if the CEO does. Mirror her vibe exactly.

**Add SALES & COMMUNICATION SUPERVISION section:**
```
When asked about calls, emails, or to "supervise" or "check on" the team:
1. Go through EVERY employee's calls and emails individually
2. Summarize: who called whom, how long, what happened
3. Flag red flags: sales calls under 2 min, missed calls not returned, outbound with no email follow-up
4. Suggest specific training: "Neel's calls are averaging 3 minutes — he might be rushing through discovery"
5. Connect call patterns to sales outcomes: high call volume but no new leads = problem
```

**Add data mapping entries:**
- "Check calls" / "How are the calls?" → RINGCENTRAL CALLS TODAY
- "Supervise the team" → Full review: calls + emails + flags
- "Train the sales team" → Call quality analysis with coaching suggestions

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyFullContext.ts` | Add RingCentral call query + per-employee call breakdown section |
| `supabase/functions/vizzy-context/index.ts` | Add RingCentral call query to snapshot |
| `src/hooks/useVizzyVoiceEngine.ts` | Casual personality upgrade + sales supervision instructions + data mappings |

