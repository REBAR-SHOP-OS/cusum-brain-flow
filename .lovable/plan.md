

## Plan: Add Event Calendar to Pixel Agent Recipe View

### What
Add the Monthly Event Calendar (already in Social Media Manager) to the Pixel agent's recipe table view, so users can browse upcoming events and click one to generate content based on that event.

### Changes — `src/pages/AgentWorkspace.tsx`

**1. Import event data**
- Import `getEventsForMonth`, `yearlyEvents`, `CalendarEvent` from `@/components/social/contentStrategyData`

**2. Add state for month selector**
- Add `const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())` (0-indexed)

**3. Add Event Calendar section below the recipe table** (after line ~740, inside the `showRecipeTable` block)
- Month selector bar (Jan–Dec buttons, same style as ContentStrategyPanel)
- List of events for the selected month, each showing: date, name, region badge, content theme, hashtags
- Each event row has a "Generate" button that sends: `"Generate a post for {event.name} — theme: {event.contentTheme}"` to the agent and closes the recipe table

### Single file change
- `src/pages/AgentWorkspace.tsx`

