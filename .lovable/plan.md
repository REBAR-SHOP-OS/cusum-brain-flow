

# Add Automations Section to Vizzy Brain Panel

## Summary
Add a new "Automations" section between "Agents" and "System Performance Overview" in the Vizzy Brain panel, showing which dashboard automations each user can see based on their role and email.

## How It Works
The `AutomationsSection` component (in `src/components/integrations/AutomationsSection.tsx`) filters automations using:
- **Admins** see all 13 automations
- **Non-admins** are blocked from `ADMIN_ONLY_IDS`: Social Media Manager, Facebook Commenter, Email Marketing, Website Manager, App Builder, SEO Manager
- **Exception**: `zahra@rebar.shop` also sees Social Media Manager

To replicate this logic in Vizzy Brain for any selected user, we need a pure function that takes an email and admin status and returns the list of visible automation names.

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`

Add a new `UserAutomationsSection` component that:
- Imports `defaultAutomations` and `ADMIN_ONLY_IDS` from `AutomationsSection.tsx` (need to export them)
- Takes the selected user's email as prop
- Determines if user is admin (super admin emails or has admin role)
- Filters automations using the same logic as the dashboard
- Renders a list of badges showing automation names the user can see

Insert as a new section between Agents (Section 2) and System Performance Overview (Section 3), around line 1205:

```tsx
{/* Section 2.5: Automations */}
<div className="rounded-xl border border-border bg-card overflow-hidden">
  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
    <Bot className="w-4 h-4 text-primary" />
    <h3 className="text-sm font-semibold text-foreground flex-1">Automations</h3>
  </div>
  <div className="p-3">
    <div className="flex flex-wrap gap-1.5">
      {visibleAutomations.map(a => (
        <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full bg-muted ...">
          {a.name}
        </span>
      ))}
    </div>
  </div>
</div>
```

### 2. `src/components/integrations/AutomationsSection.tsx`

Export `defaultAutomations` and `ADMIN_ONLY_IDS` so they can be imported by the Brain panel.

| File | Change |
|------|--------|
| `src/components/integrations/AutomationsSection.tsx` | Export `defaultAutomations` and `ADMIN_ONLY_IDS` |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add Automations section showing per-user visible automations as badges |

