

# Dashboard-First Login with Role-Based Agent Suggestions

## What Changes

1. **All users land on `/home` (dashboard) after login** instead of `/inbox`
2. **Replace "Quick Actions" on the dashboard with role-specific AI suggestions** from each user's assigned agent (e.g., Vizzy for admin, Penny for accounting, Forge for workshop)
3. **Remove `AgentSuggestionsPanel` from other pages** (CEO Portal, Shop Floor, Live Monitor) since the dashboard becomes the single hub for suggestions

## How It Works

- On login (email/password, Google, Apple), users are redirected to `/home`
- The dashboard detects the user's primary agent from their email mapping (via `userAgentMap`) and their roles (via `useUserRole`)
- Instead of hardcoded "Quick Actions" cards, the dashboard renders the `AgentSuggestionsPanel` for the user's assigned agent -- showing real, dynamic AI suggestions with Act/Snooze/Dismiss workflow
- Users without a specific agent mapping get a generic fallback (Vizzy suggestions)
- The RoleGuard already handles restricting page access per role -- no changes needed there

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Change all `navigate("/inbox")` and `redirect_uri` references to `/home` (lines 36, 47, 57, 65) |
| `src/pages/Home.tsx` | Remove "Quick Actions" section (lines 177-200). Replace with `AgentSuggestionsPanel` using the user's primary agent code. Remove `useCases`, `defaultUseCases`, `handleUseCaseClick`, and related imports |
| `src/pages/CEOPortal.tsx` | Remove `AgentSuggestionsPanel` import and usage (lines 6, 35) |
| `src/pages/ShopFloor.tsx` | Remove `AgentSuggestionsPanel` import and usage (lines 13, 104-107) |
| `src/pages/LiveMonitor.tsx` | Remove `AgentSuggestionsPanel` import and usage (lines 27, 120-123) |

### Agent Resolution Logic (Home.tsx)

The dashboard will determine which agent to show suggestions for:

```text
1. Check userAgentMap for email -> agentKey (e.g., "accounting" -> penny)
2. Fallback: check useUserRole() roles:
   - admin -> vizzy
   - accounting -> penny
   - workshop -> forge
   - sales -> blitz (sales agent code)
3. Default: vizzy
```

Map agent keys to suggestion codes:

| Agent Key | Suggestion Code | Agent Name |
|-----------|----------------|------------|
| assistant | vizzy | Vizzy |
| accounting | penny | Penny |
| shopfloor | forge | Forge |
| sales | blitz | Blitz |
| estimating | gauge | Gauge |
| support | haven | Haven |
| email | relay | Relay |

### Login Redirect Changes (Login.tsx)

```
Line 36: navigate("/inbox") -> navigate("/home")
Line 47: redirect_uri: .../inbox -> redirect_uri: .../home  
Line 57: navigate("/inbox") -> navigate("/home")
Line 65: redirect_uri: .../inbox -> redirect_uri: .../home
```

