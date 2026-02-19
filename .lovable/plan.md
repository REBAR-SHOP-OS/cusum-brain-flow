
# Fix: Bold Font on "High", "Medium", "Low" Labels in Office Page

## Investigation Summary

After a thorough audit of every component rendered on the `/office` page — including `AIExtractView`, `DetailedListView`, `ProductionQueueView`, `InventoryView`, `OptimizationView`, `TagsExportView`, `PackingSlipsView`, and `PayrollAuditView` — plus a live screenshot session, the "High / Medium / Low" labels are definitively located in **`TranscribeView.tsx`** inside the `ConfidenceBadge` component.

### Exact Location

**File:** `src/components/office/TranscribeView.tsx`
**Lines:** 116–126

```tsx
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 90 ? "text-primary bg-primary/10 border-primary/30"
    : confidence >= 70 ? "text-accent-foreground bg-accent border-accent/30"
    : "text-destructive bg-destructive/10 border-destructive/30";
  const label = confidence >= 90 ? "High" : confidence >= 70 ? "Medium" : "Low";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {confidence}% {label}
    </span>
  );
}
```

The `font-semibold` Tailwind class on line 122 makes these labels render in bold/semi-bold weight.

### Note on "Urgent" Label

The word "Urgent" does not appear in any office page component. The user's description of four labels ("Urgent", "High", "Medium", "Low") matches the task priority system elsewhere in the app, but on the `/office` page only "High", "Medium", "Low" confidence badges exist (in `TranscribeView`). The fix below targets these precisely.

## The Fix — One Surgical Change

**File:** `src/components/office/TranscribeView.tsx`
**Line:** 122

Change `font-semibold` to `font-normal` on the confidence badge `<span>`:

**Before:**
```tsx
<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
```

**After:**
```tsx
<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-normal ${color}`}>
```

## Scope

| File | Line | Change |
|---|---|---|
| `src/components/office/TranscribeView.tsx` | 122 | `font-semibold` → `font-normal` on `ConfidenceBadge` span |

## What Is NOT Changed
- `badge.tsx` base component — untouched (global change would affect entire app)
- All other office page components (`AIExtractView`, `OptimizationView`, `ProductionQueueView`, etc.)
- Any other styling, logic, database interaction, or route
- The color classes on the badge — only font-weight changes
