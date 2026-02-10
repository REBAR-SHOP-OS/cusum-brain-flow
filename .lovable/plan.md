

## Make Workspace Icons More Graphical

### What Changes

**File: `src/pages/Home.tsx`** (lines 196-220)

Upgrade the icon containers in the Workspaces section from plain `bg-primary/10` squares to visually rich, gradient-backed containers with larger icons and subtle glow effects:

- **CEO Command**: Gold/amber gradient background (`from-amber-500/20 to-yellow-500/10`), amber-tinted icon
- **Time Clock**: Teal/cyan gradient background (`from-teal-500/20 to-cyan-500/10`), teal-tinted icon  
- **Team Hub**: Purple/indigo gradient background (`from-purple-500/20 to-indigo-500/10`), purple-tinted icon

Each icon container will be slightly larger (`p-3` instead of `p-2.5`) with a subtle border ring (`ring-1 ring-white/10`) and the icons bumped to `w-6 h-6` for better presence.

### Technical Details

Update the inline workspace array to include per-card color classes, then apply them to the icon wrapper div. Only the className strings change -- no new components, files, or dependencies.

### Scope
- Single file: `src/pages/Home.tsx`
- CSS class changes only, no layout or functionality changes

