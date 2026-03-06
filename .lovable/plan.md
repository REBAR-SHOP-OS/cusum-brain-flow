

# Grant zahra@rebar.shop Access to Social Media Manager & Pixel Agent

## Problem
The Social Media Manager card is hidden from non-admin users (line 180-183 in `AutomationsSection.tsx`), and the `/social-media-manager` route is wrapped in `<AdminRoute>` (line 183 in `App.tsx`). zahra@rebar.shop is not an admin, so she can't see or access it.

## Changes

### 1. `src/components/integrations/AutomationsSection.tsx`
- Import `useAuth` to get current user email
- Modify `visibleAutomations` logic: if user email is `zahra@rebar.shop`, also show `social-media-manager` (remove it from the filtered-out set for this user)

### 2. `src/components/auth/AdminRoute.tsx`
- Add an `allowedEmails` optional prop
- If the current user's email is in `allowedEmails`, bypass the admin check and render children
- This keeps the component reusable

### 3. `src/App.tsx`
- Update the `/social-media-manager` route to pass `allowedEmails={["zahra@rebar.shop"]}` to `AdminRoute`

This gives zahra@rebar.shop:
- Visibility of the Social Media Manager card on the dashboard
- Access to the `/social-media-manager` route (which includes the Pixel agent for content creation)
- No other admin privileges are granted

