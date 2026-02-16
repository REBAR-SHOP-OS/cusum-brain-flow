
# Restyle /empire — Dark Cyberpunk Dashboard

## Overview

Replace the current light-themed EmpireBuilder page with the dark cyberpunk dashboard UI provided. The page keeps all existing chat/agent logic but gets a completely new visual shell with sidebar, top bar, and dark gradient canvas.

## Approach

Create two new components and update EmpireBuilder to use them. All chat logic (state, handlers, file upload, agent calls) stays untouched in EmpireBuilder.

### New Files

| File | Purpose |
|---|---|
| `src/components/empire/EmpireSidebar.tsx` | 72px icon-only sidebar with dark glass styling, nav items, help button |
| `src/components/empire/EmpireTopbar.tsx` | Cyan `#35E6E6` header bar with Dashboard label, search input, bell icon, avatar with user initials |

### Modified File

| File | Change |
|---|---|
| `src/pages/EmpireBuilder.tsx` | Wrap entire return in the dark app shell layout (sidebar + topbar + gradient canvas). Restyle InputBox, suggestion pills, chat bubbles, and loading indicator to dark theme colors. |

## Component Details

### EmpireSidebar
- 72px wide, `bg-black/30 backdrop-blur border-r border-white/10`
- Top: gradient logo square (fuchsia-to-indigo)
- Nav: 11 icon buttons (Home, BarChart2, Globe, Search, Users, DollarSign, FileText, Boxes, Activity, Settings, Shield) with `hover:bg-white/10` rounded-xl
- Bottom: HelpCircle icon

### EmpireTopbar
- `bg-[#35E6E6] text-black h-14 border-b border-black/30`
- Left: LayoutGrid icon + "Dashboard" label
- Center-right: search pill (`bg-black/10 rounded-xl`, hidden on mobile)
- Right: Bell icon button, circular avatar with user initials (falls back to "SA")

### EmpireBuilder Changes

**Outer wrapper**: Replace the current `flex flex-col h-full` with `min-h-screen w-full bg-[#070A12] text-white` containing a flex row of sidebar + main content.

**Background gradient**: Replace the light gradient with the dark radial gradient:
`bg-[radial-gradient(...cyan...),radial-gradient(...orange...),linear-gradient(135deg,#0A0F25,#141B3A,#221B3B,#301D2E)]`

Plus a floating avatar bubble decoration in the top-right corner.

**InputBox restyle**:
- Container: `bg-white/5 backdrop-blur border border-white/10 rounded-2xl`
- Focus state: `border-white/20`
- Drag state: `border-cyan-400/60 bg-cyan-500/5`
- Text/placeholder: `text-white placeholder:text-white/40`
- Attachment chips: `bg-white/10 border-white/10 text-white/70`
- Plus button: `bg-white/5 hover:bg-white/10 text-white/80`
- Send button active: `bg-[#35E6E6] text-black`; inactive: `bg-white/10 text-white/30`

**Suggestion pills**: `bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white rounded-full`

**Chat messages (conversation view)**:
- User bubbles: `bg-[#35E6E6] text-black rounded-br-md`
- Agent bubbles: `bg-white/5 backdrop-blur border border-white/10 text-white rounded-bl-md`
- Agent avatar: gradient `from-cyan-400 to-teal-500` instead of orange
- Loading dots: `bg-white/40`
- Bottom input bar: `bg-black/30 backdrop-blur-xl border-t border-white/10`

**Hero text**: H1 white with "great" in `text-[#FF7A18]`, subtitle in `text-white/70`
