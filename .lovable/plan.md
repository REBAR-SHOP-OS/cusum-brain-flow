

# Restrict 6 Modules to Admin-Only Access

## What Changes

Six modules will be gated so only users with the `admin` role can see and access them. Non-admin users will see neither the navigation cards nor be able to reach the routes.

**Affected modules:**
- Website Manager (`/website`)
- SEO Manager (`/seo`)
- Social Media Manager (`/social-media-manager`)
- Facebook Commenter (`/facebook-commenter`)
- Email Marketing (`/email-marketing`)
- App Builder / Empire (`/empire`)

---

## Changes by File

### 1. `src/pages/Home.tsx` -- Remove Website + SEO workspace cards for non-admins

- Import `useUserRole` hook
- Wrap the Website and SEO entries in the Workspaces grid with an `isAdmin` check so they only render for admins

### 2. `src/components/integrations/AutomationsSection.tsx` -- Filter automation cards for non-admins

- Import `useUserRole` hook
- Filter out 6 automation cards (social-media-manager, facebook-commenter, email-marketing, website-manager, app-builder, seo-manager) unless `isAdmin` is true
- Non-admin users still see the remaining automations (Inbox Manager, Daily Summarizer)

### 3. `src/App.tsx` -- Add route-level guards

- Wrap the 6 routes (`/website`, `/seo`, `/social-media-manager`, `/facebook-commenter`, `/email-marketing`, `/empire`) with an admin-only guard component
- Create a small inline `AdminRoute` wrapper that checks `useUserRole().isAdmin` and redirects unauthorized users to `/` with an "Access Restricted" toast

---

## Technical Details

### Admin check
Uses the existing `useUserRole()` hook which queries `user_roles` table via the `has_role` security definer function. No new database changes needed.

### Guard component (in App.tsx)
```text
AdminRoute wrapper:
  - Checks useUserRole().isAdmin
  - If loading: shows skeleton
  - If not admin: redirects to "/" with toast
  - If admin: renders children
```

### Files touched
| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Filter workspace cards by admin role |
| `src/components/integrations/AutomationsSection.tsx` | Filter automation cards by admin role |
| `src/App.tsx` | Add AdminRoute guard to 6 routes |

### No changes to
- Database schema
- Existing page components (SeoModule, WebsiteManager, etc.)
- Edge functions
- RLS policies
