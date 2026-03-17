

# Fix: CEO Dashboard Shows "Access Restricted" Due to Auth Loading Race

## Problem
`CEOPortal.tsx` checks `isSuperAdmin` immediately. While auth is loading (`user` is null), `isSuperAdmin` returns false, so the page shows "Access Restricted" before the user session has loaded. The RoleGuard passes children through during loading, but the CEOPortal page itself blocks rendering.

## Solution
Add an auth `loading` check to `CEOPortal.tsx`. While auth is loading, show a spinner instead of the "Access Restricted" screen.

**File:** `src/pages/CEOPortal.tsx`

```tsx
import { useAuth } from "@/lib/auth";

export default function CEOPortal() {
  const { isSuperAdmin } = useSuperAdmin();
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    // ... existing access restricted screen
  }

  return (
    <ScrollArea className="h-full">
      <CEODashboardView />
    </ScrollArea>
  );
}
```

This single change ensures the dashboard waits for auth before deciding access, preventing the false "Access Restricted" flash.

