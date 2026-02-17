

# Fix: Wire the "Save Changes" Button in Member Area Profile

## Problem

In the **Member Area > My Profile** tab, the "Save Changes" button does nothing when clicked. The form inputs for "Full Name" and "Job Title" use `defaultValue` (uncontrolled inputs), so there is no state tracking user edits. The button has no `onClick` handler.

## Root Cause

Lines 178-208 in `MemberAreaView.tsx` (`MyProfileTab`):
- `<Input defaultValue={myProfile?.full_name} />` -- uncontrolled, edits are not captured
- `<Input defaultValue={myProfile?.title} />` -- same issue
- `<Button>Save Changes</Button>` -- no `onClick`, no save logic

## Fix (surgical, single component)

### File: `src/components/office/MemberAreaView.tsx` -- `MyProfileTab` function only

1. Add local state for the editable fields (`fullName`, `title`), initialized from `myProfile`
2. Sync state when `myProfile` loads/changes (useEffect)
3. Wire `onClick` on Save button to call `updateProfile.mutate()` with the edited values
4. Add a `saving` guard to prevent double-clicks (disable button while mutation is pending)
5. Show success feedback via existing toast (already built into `updateProfile` hook)

### Changes in detail

```typescript
// Add state for editable fields
const [fullName, setFullName] = useState(myProfile?.full_name || "");
const [title, setTitle] = useState(myProfile?.title || "");

// Sync when profile loads
useEffect(() => {
  if (myProfile) {
    setFullName(myProfile.full_name);
    setTitle(myProfile.title || "");
  }
}, [myProfile]);

// Save handler with guard
const handleSave = () => {
  if (!myProfile || updateProfile.isPending) return;
  updateProfile.mutate({
    id: myProfile.id,
    full_name: fullName.trim(),
    title: title.trim() || null,
  });
};
```

Then update the inputs from `defaultValue` to controlled `value` + `onChange`, and wire the button:

```
<Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
<Input value={title} onChange={(e) => setTitle(e.target.value)} />
<Button onClick={handleSave} disabled={updateProfile.isPending}>
  {updateProfile.isPending ? "Saving..." : "Save Changes"}
</Button>
```

## Guards and Safety

- **No domino effects**: Only touches `MyProfileTab` inner function; no changes to hook signatures, no changes to Team Access or System Config tabs
- **Double-click guard**: Button disabled while `updateProfile.isPending`
- **Trim guard**: Whitespace-only names are trimmed; empty title becomes null
- **Sync guard**: useEffect re-syncs local state if profile data changes externally (e.g., admin updates your name)
- **No schema changes**: Uses existing `updateProfile` mutation from `useProfiles` hook

## Files Modified

| File | Change |
|---|---|
| `src/components/office/MemberAreaView.tsx` | Wire Save button with controlled inputs and mutation call in `MyProfileTab` only |
