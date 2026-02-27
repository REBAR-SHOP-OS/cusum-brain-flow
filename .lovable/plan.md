

## Plan: Upgrade Vizzy to Executive Intelligence Mode

Three files to modify. No schema changes. Two edge functions to redeploy.

### 1. `src/lib/vizzyContext.ts` — Upgrade the client-side system prompt (voice/Vizzy sessions)

Replace the opening personality block (lines 66-73) with the Executive Intelligence identity:
- COO+CFO hybrid, not a passive assistant
- Response format mandate: What happened → Why it matters → Risk level → Recommended action → Confidence
- CEO behavioral intelligence section (Sattar's risk tolerance, communication style adaptation)
- Proactive intelligence rules (anomaly detection, pattern recognition, cross-system correlation)
- Advanced reasoning rules (challenge assumptions, flag inconsistencies, separate noise from signal)
- Explainability requirement (data sources, reasoning logic, risk assessment, alternative interpretation)

Replace the closing INSTRUCTIONS block (lines 199-204) with upgraded analytical directives:
- Build mental models: CLV, payment delay risk, delivery delay prediction, production bottleneck detection, revenue velocity
- Prioritize by financial impact → legal risk → customer retention → operational slowdown
- Never give shallow summaries; always analyze root cause
- Security & governance: log analysis steps, never auto-execute financial changes

### 2. `supabase/functions/admin-chat/index.ts` — Upgrade the chat system prompt (lines 1154-1245)

Inject the same Executive Intelligence standards into the JARVIS chat prompt:
- Add "INTELLIGENCE STANDARD" section after capabilities
- Add "ANALYTICAL MODELS" section (CLV, payment delay risk, bottleneck detection)
- Add "RESPONSE FORMAT" mandate (every substantive answer must include what/why/risk/action/confidence)
- Add "PROACTIVE INTELLIGENCE MODE" with specific thresholds and priority ranking
- Add "EXPLAINABILITY REQUIREMENT"
- Upgrade "RULES" section with: challenge assumptions, flag cross-system inconsistencies, detect duplicates/automation errors

### 3. `supabase/functions/vizzy-daily-brief/index.ts` — Upgrade daily brief from summary to executive intelligence brief (lines 78-97)

Replace the 5-bullet-point format with the executive brief format:
- Revenue trend vs prior period
- Cash flow forecast risk signals
- Production risk signals and bottleneck detection
- Delivery performance health
- High-value customer changes
- Automation failures or system anomalies
- Top strategic recommendation with reasoning
- Ranked by severity, not category
- Each item must include risk level and recommended action

### Deployment
- Redeploy `admin-chat` and `vizzy-daily-brief` edge functions

