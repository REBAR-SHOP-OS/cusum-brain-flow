

## Plan: Restrict Vizzy to Super Admins Only

Vizzy is already partially restricted — the `/agent/assistant` route and Home page card are guarded. But two areas still expose Vizzy to all users:

### Changes

**1. `src/components/layout/AppLayout.tsx`** — Guard FloatingVizzyButton behind super admin check
- Import `useSuperAdmin`
- Wrap `<FloatingVizzyButton />` with `{isSuperAdmin && <FloatingVizzyButton />}`

**2. `src/components/vizzy/FloatingVizzyButton.tsx`** — Add internal guard as safety net
- Import `useSuperAdmin`, return `null` if not super admin

**3. `src/pages/LiveChat.tsx`** — Redirect non-super-admins away from `/chat` (which defaults to Vizzy)
- Import `useSuperAdmin`, redirect to `/home` if not super admin

**4. `supabase/functions/vizzy-daily-brief/index.ts`** — Give Vizzy full financial access (always `includeFinancials: true`)
- Currently gates financials behind admin role; since only super admins can access Vizzy, always include financials
- Change line 64: `includeFinancials: isAdmin` → `includeFinancials: true`

### Technical details
- `useSuperAdmin` hook checks against hardcoded emails: `sattar@rebar.shop`, `radin@rebar.shop`, `ai@rebar.shop`
- The `AgentWorkspace.tsx` already redirects non-super-admins from `/agent/assistant` (line 54-57) — no change needed there
- The `[STOP]` error in the screenshot is a separate AI response generation issue, not related to access control

