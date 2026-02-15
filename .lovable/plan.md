

# Add "Website Manager" to Automations Section

Add a new automation card for the Website Manager module to the existing Automations grid, matching the style of the other cards.

## Changes

### File: `src/components/integrations/AutomationsSection.tsx`

1. **Import `Globe` icon** from lucide-react (to represent the website manager)

2. **Add `"website"` to the type unions**:
   - `Automation.color` -- add a new color option (e.g. `"indigo"` for a distinct look, or reuse an existing one)
   - `Automation.icon` -- add `"website"`

3. **Add new entry to `defaultAutomations` array**:
   ```
   {
     id: "website-manager",
     name: "Website Manager",
     description: "Visual editing and AI management for rebar.shop",
     enabled: true,
     color: "blue",       // or a new gradient
     icon: "website",
     route: "/website",
   }
   ```

4. **Add to `iconComponents` map**: `website: Globe`

No other files need changes -- the `/website` route and page already exist.

