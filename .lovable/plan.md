

# Export: Auth/Login Database Structure as SQL File

## What
Generate a single consolidated SQL file documenting the complete authentication and login database structure, written to `/mnt/documents/`.

## Contents of the SQL File

The file will consolidate all auth-related schema into one reference document:

### 1. `app_role` Enum
All role values: `admin`, `sales`, `accounting`, `office`, `workshop`, `field`, `shop_supervisor`, `customer`

### 2. `user_roles` Table
- `id`, `user_id` (FK → auth.users), `role` (app_role), `created_at`
- UNIQUE on (user_id, role)
- RLS: admins manage all, users view own

### 3. `profiles` Table
- `id`, `user_id` (FK → auth.users, UNIQUE), `full_name`, `title`, `department`, `duties`, `phone`, `email`, `avatar_url`, `is_active`, `preferred_language`, `employee_type`, `company_id`, `manager_id`, `phone_number`, `created_at`, `updated_at`
- RLS: authenticated read, admin CRUD, user self-update

### 4. `employee_salaries` Table
- `profile_id` (FK → profiles), `salary_amount`, `salary_type`, `notes`
- RLS: admin-only

### 5. Helper Functions
- `has_role(_user_id, _role)` — SECURITY DEFINER
- `has_any_role(_user_id, _roles[])` — SECURITY DEFINER
- `get_my_company_id(_user_id)` — returns company_id from profiles

### 6. Triggers
- `handle_new_user()` — auto-create profile on auth.users INSERT
- `update_profiles_updated_at` / `update_salaries_updated_at`

## Output
Single file: `/mnt/documents/auth_database_structure.sql`

