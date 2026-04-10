

# Fix Company Rules Dialog — Z-Index Layering

## Problem
The CompanyRulesDialog uses standard `DialogContent` which renders at default z-50. The Vizzy Brain panel sits at z-[100000], so the dialog opens **behind** the panel and appears non-functional.

## Fix

### File: `src/components/vizzy/CompanyRulesDialog.tsx`

Replace the standard `Dialog`/`DialogContent` with the portal-based pattern used by other Vizzy Brain dialogs:

1. Import `DialogPortal`, `DialogOverlay`, and `DialogPrimitive` (from `@radix-ui/react-dialog`)
2. Set `DialogOverlay` to `z-[100001]`
3. Set `DialogContent` to `z-[100002]`
4. Add `onInteractOutside` and `onPointerDownOutside` prevention handlers so the dialog stays open during typing
5. Add manual close button (X icon)

This matches the exact pattern used by AddUserDialog, AgentReportDialog, and other modals that open above VizzyBrainPanel.

### Scope
- 1 file modified: `CompanyRulesDialog.tsx`
- No other changes needed

