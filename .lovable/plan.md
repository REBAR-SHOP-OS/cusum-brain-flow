

## Restyle Workspace Cards to Match Automations Style

### What Changes

**File: `src/pages/Home.tsx`** (Workspaces section, lines 196-220)

Replace the current plain dark cards with colorful gradient cards similar to the Automations section, but with a different feel (smaller, no switch, horizontal layout).

Each card gets:
- A full gradient background (like the Automation cards)
- A large decorative icon in the bottom-right at low opacity
- White text on the gradient
- Hover scale effect

Color scheme (distinct from Automations):
- **CEO Command**: Amber-to-orange gradient, Crown decorative icon
- **Time Clock**: Teal-to-emerald gradient, Clock decorative icon
- **Team Hub**: Indigo-to-purple gradient, MessageSquare decorative icon

### Technical Details

Replace the current workspace card rendering block with gradient cards that include:
- `bg-gradient-to-br` with unique color pairs per card
- White text (`text-white`)
- Decorative icon positioned `absolute right-3 bottom-3 opacity-20 w-16 h-16`
- A subtle `from-black/20 to-transparent` overlay for depth
- `hover:scale-[1.02]` transition matching the Automations cards
- `rounded-2xl` to match Automations rounded corners
- No `Card` component needed -- plain divs with gradient classes (same approach as AutomationCard)

### Scope
- Single file: `src/pages/Home.tsx`
- Only the Workspaces section rendering changes
- No new files, components, or dependencies
