

# Replace CEO Portal Sidebar Entry with Live Monitor

## Changes

### 1. `src/components/layout/AppSidebar.tsx` (line 157)
- Rename "CEO Portal" to "Live Monitor"
- Change icon from `BarChart3` to `Monitor`
- Keep the same route `/ceo` and access restrictions

### 2. `src/pages/CEOPortal.tsx`
- Replace the entire CEO Portal content with `LiveMonitorView` component
- Remove all CEO-specific imports (DailyBriefingCard, BusinessHeartbeat, etc.)
- Keep the super admin access guard

### 3. `src/App.tsx` (line 136)
- No route change needed — `/ceo` route stays, just renders different content

