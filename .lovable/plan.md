
# Move PIN Lock to Protect Entire Admin Panel

## What Changes
The PIN lock (7671) currently only gates the CEO Dashboard tab. It will be moved to gate the **entire Admin Panel** -- users must enter the PIN before seeing any content (employees, CEO dashboard, etc.).

## How It Works
- After the role check passes (confirming user is admin), show the PIN screen **before** any tabs render
- Once unlocked, both the Employees tab and CEO Dashboard tab are accessible without further prompts
- The CEO Dashboard tab loses its separate lock icon and PIN gate since the whole panel is already protected

## Technical Details

### File: `src/components/pipeline/PipelineAISheet.tsx` -- No changes
### File: `src/pages/AdminPanel.tsx` -- Single file modification

1. Rename `CEO_PIN` to `ADMIN_PIN` and `ceoUnlocked` to `panelUnlocked` for clarity
2. Move the PIN gate UI to render **after** the `!isAdmin` check and **before** the `<Tabs>` component
3. When `panelUnlocked` is `false`, show the full-screen PIN entry (same UI, updated title to "Admin Panel Locked")
4. Remove the per-tab PIN lock from the CEO Dashboard tab -- it renders `<CEODashboardView />` directly
5. Remove the `<Lock>` icon from the CEO Dashboard tab trigger since it's no longer separately locked

No other files are touched. Surgical change to one file only.
