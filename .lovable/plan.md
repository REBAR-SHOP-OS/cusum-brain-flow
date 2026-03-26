

# Change Flow: Approve First, Then Edit

## What
Currently both "Approve & Download" and "Edit Video" buttons are available simultaneously. The user wants a two-step flow:
1. First, user must **approve** the scene composition (without downloading)
2. Only after approval, the user can enter the edit page

## Change

### `src/components/ad-director/AdDirectorContent.tsx`

**1. Add `approved` state** — `useState<boolean>(false)`, reset to `false` when `flowState` changes away from `"result"`

**2. Change button layout:**
- **Before approval**: Show a single "Approve Composition" button (with `Check` icon). Clicking sets `approved = true`.
- **After approval**: Show "Download" button and "Edit Video" button side by side. "Edit Video" navigates to editing as before.

```tsx
{/* Action buttons */}
<div className="flex items-center justify-center gap-3">
  {!approved ? (
    <Button onClick={() => setApproved(true)} className="gap-2">
      <Check className="w-4 h-4" />
      Approve Composition
    </Button>
  ) : (
    <>
      <Button onClick={handleDownload} disabled={!finalVideoUrl} className="gap-2">
        <Download className="w-4 h-4" />
        Download
      </Button>
      <Button variant="outline" onClick={() => service.patchState({ flowState: "editing" })} className="gap-2">
        <Pencil className="w-4 h-4" />
        Edit Video
      </Button>
    </>
  )}
</div>
```

**3. Reset `approved` to `false`** when scenes are regenerated (in `handleRegenerateScene`), so user must re-approve after changes.

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Add `approved` state, split buttons into approve-first then edit/download flow |

