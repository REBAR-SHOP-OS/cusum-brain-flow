

# Enforce Zero-Visibility for Unauthorized Users

## Problem

Current `ProtectedRoute` only checks if a `user` object exists — it does NOT verify the email is whitelisted. There is a race condition: between the moment a session is established (e.g. via Google OAuth) and the auto-sign-out in `onAuthStateChange`, an unauthorized user could briefly see system content (pages, nav, data).

## Solution

Add a whitelist check directly in `ProtectedRoute`. If a user is authenticated but their email is NOT in `allowedLoginEmails`, render a blank screen and trigger sign-out — showing absolutely nothing.

## Changes

### File: `src/components/auth/ProtectedRoute.tsx`

Add email whitelist verification after the `user` check:

```typescript
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";

export function ProtectedRoute({ children }) {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return /* loading spinner (existing) */;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // CRITICAL: If user exists but email is NOT whitelisted → show nothing, sign out
  const email = user.email?.toLowerCase() ?? "";
  const isAllowed = ACCESS_POLICIES.allowedLoginEmails.some(
    (e) => e.toLowerCase() === email
  );

  if (!isAllowed) {
    signOut(); // trigger sign-out in background
    return null; // render absolutely nothing
  }

  return <>{children}</>;
}
```

## Impact
- Any unauthorized user who somehow gets a session sees a completely blank screen
- Sign-out is triggered immediately in the background
- Works as a second defense layer alongside `onAuthStateChange` in `auth.tsx`
- No changes to any other file
- Zero risk to existing authorized users

