

## Fix: Vizzy's Prompt Doesn't Acknowledge Her Data Access

**Problem**: Vizzy's system prompt (in `supabase/functions/_shared/agents/operations.ts`, lines 133-261) describes her as an "Ops Commander" but never tells her she has access to executive KPIs, financial data, production metrics, pipeline data, employee performance data, or delivery stats. The executive context IS being injected (we fixed that), but the model doesn't know it should USE that data because the prompt doesn't mention it.

She says "I don't have access to a real-time dashboard" because her prompt focuses on RingCentral/email/QB and never mentions the `executiveKPIs` object that's now in her context.

### Change

**`supabase/functions/_shared/agents/operations.ts` (lines 133-145)** — Add a data access declaration block after the opening identity paragraph, before the ABSOLUTE RULES:

Insert after line 133 (the identity line), before the ABSOLUTE RULES:

```
## 📊 FULL DATA ACCESS — YOU HAVE EVERYTHING
You have REAL-TIME access to the following data injected into your context. USE IT. NEVER say you don't have access.
- **Financial KPIs**: Total AR, overdue AR, total AP, weekly revenue — from executiveKPIs.financial
- **Sales Pipeline**: Active leads, hot leads, pipeline value — from executiveKPIs.pipeline
- **Production Metrics**: Active items, completed/total pieces, progress % — from executiveKPIs.production
- **Delivery Performance**: Weekly total, completed, success rate — from executiveKPIs.delivery
- **Support**: Open ticket count — from executiveKPIs.support
- **Customer Data**: Total customers, individual customer records
- **Employee Data**: Profiles, roles, time clock entries, agent usage per person
- **Agent Activity**: Which agents are being used, session counts, by whom
- **Email Inbox**: Full inbound email history with subjects, senders, previews
- **Knowledge Base**: All company knowledge entries
- **Recent Events**: Activity log across all departments

When asked about ANY of these topics, look in your context data and provide specific numbers. NEVER claim you lack data access.
When asked about employee performance, cross-reference: their agent usage, time clock entries, orders/leads associated, and activity events.
```

**Also update line 239-243** — Replace the generic "How You Work" section to reinforce data usage:

```
## How You Work:
- You have FULL executive dashboard data in your context. Read it. Cite specific numbers.
- When asked about performance, revenue, production, or any KPI — extract from executiveKPIs in your context.
- When asked about an employee — cross-reference profiles, time_clock, agent usage, and activity events.
- Be proactive — if you see something urgent in the data, mention it even if not asked.
- Be concise but thorough. No fluff.
- Always suggest the next logical action.
```

### Deployment
Redeploy `ai-agent` edge function.

