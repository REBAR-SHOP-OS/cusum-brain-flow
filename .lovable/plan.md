

## Fix: Stop Auto-Filling Project Name with Customer Name

### Problem

When a user selects a customer from the "Customers" section in the project dropdown, the code sets `newProjectName = c.name` (the customer name). This creates projects named after customers (e.g., "1000197066 ONTARIO INC.") instead of proper project names. The database confirms this -- the only project has `name = "1000197066 ONTARIO INC."` which is identical to its linked customer name.

### Root Cause

In `src/components/office/AIExtractView.tsx`, lines 873-882, when a customer is selected:
```
setNewProjectName(c.name);   // <-- BUG: sets project name to customer name
setCustomer(c.name);
setManifestName(c.name);     // <-- also sets manifest name to customer name
```

### Fix

**`src/components/office/AIExtractView.tsx`**

1. In the Customers `CommandItem` `onSelect` handler (lines 873-882):
   - Keep `setCustomer(c.name)` -- correct, this sets the customer field
   - Change `setNewProjectName("")` -- leave project name blank so the user must type a real name
   - Remove `setManifestName(c.name)` -- don't auto-fill the manifest/scope name with a customer name either
   - Keep `setCreateNewProject(true)` and `setSelectedBarlistId("")` -- these are correct

2. Add validation in `handleExtract` to require a non-empty `newProjectName` when `createNewProject` is true, showing a toast error if missing.

This ensures:
- Selecting a customer correctly fills the "Customer" field
- The "Project Name" input is left blank, forcing the user to enter a descriptive project name
- Existing projects already in the database are unaffected (they display their stored `name` field correctly)

