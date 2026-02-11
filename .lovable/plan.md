## Vizzy — Full Jarvis Mode

### What changed
- Vizzy now loads a **complete business snapshot** on session start: financials (QB), production (cut plans, machines), CRM (leads), customers, deliveries, team, and recent events
- All conversations are **logged to `vizzy_interactions`** table with full transcripts
- **Daily journals** can be stored in `vizzy_journals` table
- Context prompt instructs Vizzy to act as a CEO's Jarvis — cross-referencing data, flagging risks, tracking topics discussed

### Files
- `src/hooks/useVizzyContext.ts` — aggregates all business data
- `src/lib/vizzyContext.ts` — formats data into agent-readable context
- `src/pages/VizzyPage.tsx` — auto-start + transcript saving
- `src/components/vizzy/VoiceVizzy.tsx` — floating button + transcript saving
- DB: `vizzy_interactions`, `vizzy_journals` tables with RLS
