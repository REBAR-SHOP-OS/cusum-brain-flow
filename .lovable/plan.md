

# Why Saurabh's Delete Doesn't Work

## Root Cause

**RLS policy restriction.** All three delete policies (`barlists`, `projects`, `cut_plans`) require `has_role(auth.uid(), 'admin')`:

```text
DELETE on barlists  → requires admin role
DELETE on projects  → requires admin role  
DELETE on cut_plans → requires admin role
```

Saurabh's roles: **workshop, office, sales** — he does NOT have `admin`.

When he clicks delete, the Supabase query returns **zero affected rows** (RLS silently filters it out). The code doesn't check for `count === 0`, so it shows "Deleted" toast but nothing actually gets removed.

## Fix

### 1. Add `office` role to delete policies (or give Saurabh admin)

**Option A — Expand RLS policies** to allow `office` role to delete (recommended if office users should manage production queue):

```sql
-- barlists
DROP POLICY "Admin can delete barlists" ON barlists;
CREATE POLICY "Admin or office can delete barlists" ON barlists
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'office')));

-- Same pattern for projects and cut_plans
```

**Option B — Grant Saurabh admin role** (simpler but broader access):
```sql
INSERT INTO user_roles (user_id, role) VALUES ('1a618127-...', 'admin');
```

### 2. Fix silent failure in UI

Update `handleDeleteBarlist`, `handleDeleteProject`, etc. to check if 0 rows were affected and show an appropriate error message ("Permission denied" instead of false success).

### Summary
- **Problem**: Delete RLS policies are admin-only; Saurabh has workshop/office/sales roles
- **Result**: Delete silently fails — no error, no removal
- **Fix**: Either expand delete policies to include `office` role, or grant Saurabh admin

