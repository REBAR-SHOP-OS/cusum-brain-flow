

## Plan: Lock Vizzy to Super Admins + Inject ERP Data into Voice Sessions

### Problem
1. The `/vizzy` route has no super admin check — anyone with the URL can access Vizzy Live
2. Vizzy's voice instructions are generic ("you have knowledge of...") but she doesn't receive actual ERP data, so she answers generally instead of using real business numbers

### Changes

**1. Add super admin guard to VizzyLive.tsx**
- Import `useSuperAdmin` and add the same guard pattern used in `LiveChat.tsx` (`if (!isSuperAdmin) return <Navigate to="/home" replace />`)
- This ensures `/vizzy` is inaccessible to non-super-admins

**2. Inject ERP context into Vizzy voice session**
- In `useVizzyVoiceEngine.ts`, before calling `startSession`, fetch a compressed business context briefing from the existing `vizzy-briefing` edge function
- Prepend the ERP data snapshot to `VIZZY_INSTRUCTIONS` so the OpenAI Realtime model has actual numbers (AR/AP, orders, leads, production, deliveries, team presence, etc.)
- Flow: `useVizzyVoiceEngine` calls `supabase.functions.invoke("vizzy-daily-brief")` on session start → gets the briefing text → appends it to the instructions string before passing to `useVoiceEngine`

**3. Update useVizzyVoiceEngine to be async-context-aware**
- Change from a static instructions string to a dynamic one that includes the fetched ERP snapshot
- Add a `contextLoaded` state so VizzyLive can show a loading indicator while context is being fetched
- The voice engine config's `instructions` field will be: `VIZZY_INSTRUCTIONS + "\n\n═══ LIVE BUSINESS DATA ═══\n" + briefingText`

### Technical Details
- `vizzy-daily-brief` already builds full context via `buildFullVizzyContext` and returns a structured briefing — we reuse this
- No new edge functions or database changes needed
- The briefing is ~2000 words after compression, well within OpenAI Realtime's instruction limit
- Super admin check uses the existing `useSuperAdmin` hook (email allowlist)

