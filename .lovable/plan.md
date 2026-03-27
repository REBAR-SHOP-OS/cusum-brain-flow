

# Add "Create New Person" to Face Memory Enrollment

## Problem
The "Enroll New Person" dropdown in the Face Memory panel only lists existing profiles. If someone isn't in the system yet, there's no way to add them directly from this panel.

## Solution
Add a "+ Add New Name" option at the top of the Select dropdown. When selected, show an inline text input for the new person's name. On confirmation, create a new profile in the `profiles` table, then proceed with the normal photo enrollment flow.

## Changes

**File:** `src/components/timeclock/FaceMemoryPanel.tsx`

1. **New state**: Add `newPersonName` (string) and `creatingNewPerson` (boolean) state variables.

2. **Add "Create New" option in Select**: Add a special `SelectItem` with value `__new__` labeled "+ Add New Name" at the top of the dropdown list.

3. **Handle selection**: When `__new__` is selected, show an inline Input field + confirm button instead of jumping to camera. When confirmed:
   - Call `createProfile` from `useProfiles()` to insert a new profile with the entered name
   - Set the newly created profile's ID as `selectedProfileId`
   - Proceed to the camera/capture step

4. **Reset**: Clear `newPersonName` and `creatingNewPerson` in `resetAddForm`.

### UI Flow
```text
Select a person...
├── + Add New Name        ← new option
├── Ai
├── Amir AHD
├── ...
└── Saurabh Seghal (re-enroll)
```

When "+ Add New Name" is clicked → input field appears → user types name → clicks ✓ → profile created → camera starts for enrollment photos.

## Technical Details
- Uses existing `createProfile` mutation from `useProfiles()` hook
- New profile created with `is_active: true`, empty duties array, and the entered `full_name`
- No new database changes needed — uses existing `profiles` table insert
- The `useCompanyId` hook (used inside `useProfiles`) ensures `company_id` is set automatically

