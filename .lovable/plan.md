

# Fix: Post-Login Not Entering App

## Problem
After Google OAuth login, users land on `/` (the public Landing page) instead of `/home`. Two issues:

1. **Landing page doesn't redirect authenticated users** -- if you're logged in and visit `/`, you see the marketing page instead of being sent to `/home`.
2. **OAuth redirect_uri** points to `/home` but the OAuth callback may land on `/` first (depending on the flow), and no redirect logic catches it.

## Solution

**Modify `src/pages/Landing.tsx`**: Add an auth check at the top of the component. If the user is already authenticated, redirect to `/home` immediately using `<Navigate to="/home" />`.

```typescript
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";

// Inside the component, at the top:
const { user, loading } = useAuth();
if (loading) return <loading spinner>;
if (user) return <Navigate to="/home" replace />;
```

This ensures that any authenticated user hitting `/` (whether from OAuth callback, direct navigation, or bookmark) is immediately routed into the app.

## Files Changed
- **`src/pages/Landing.tsx`** -- add auth-aware redirect at component top

