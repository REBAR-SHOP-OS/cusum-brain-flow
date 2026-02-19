

# Management Tasks Page

## Overview
Create a new `/management-tasks` page that mirrors the existing `/tasks` page but is restricted to three specific users: Sattar, Vicky, and Neel. Tasks on this page will be stored in the same `tasks` table but scoped so only these three users can see and manage them.

## Access Control
The page will be gated by email address. Only these accounts can access it:
- `sattar@rebar.shop` (Sattar Esmaeili)
- `anderson@rebar.shop` (Vicky Anderson)  
- `neel@rebar.shop` (Neel Mahajan)

Any other user navigating to `/management-tasks` will be redirected to `/home`.

## Implementation Steps

### 1. Create the Management Tasks page
- **New file:** `src/pages/ManagementTasks.tsx`
- Copy the full Tasks page logic but add a `management_only` tag/filter so management tasks are kept separate from regular tasks
- Add email-based access check at the top of the component -- if the current user's email is not in the allowed list, redirect away
- Filter tasks to only show those tagged as management tasks (using a field like `is_management: true` or a metadata tag)

### 2. Database change
- Add a boolean column `is_management` (default `false`) to the `tasks` table so management tasks are separated from regular employee tasks
- The Management Tasks page queries only `is_management = true` tasks
- The existing `/tasks` page continues showing `is_management = false` (or all) tasks

### 3. Register the route
- **Edit:** `src/App.tsx` -- add a new protected route for `/management-tasks`

### 4. Add sidebar navigation (optional)
- Add a "Management Tasks" link visible only to the three allowed emails

## Technical Details

**Access guard (inside ManagementTasks.tsx):**
```typescript
const MANAGEMENT_EMAILS = ["sattar@rebar.shop", "anderson@rebar.shop", "neel@rebar.shop"];
const { user } = useAuth();
if (!MANAGEMENT_EMAILS.includes(user?.email || "")) {
  return <Navigate to="/home" replace />;
}
```

**Database migration:**
```sql
ALTER TABLE public.tasks ADD COLUMN is_management boolean NOT NULL DEFAULT false;
```

**Query filter in ManagementTasks:**
```typescript
supabase.from("tasks").select("...").eq("is_management", true)
```

**Route in App.tsx:**
```tsx
<Route path="/management-tasks" element={<P><ManagementTasks /></P>} />
```

The Management Tasks page will have identical Kanban board UI, task creation dialog, detail drawer, comments, audit log, and attachments -- just scoped to management-only tasks visible to the three authorized users.

