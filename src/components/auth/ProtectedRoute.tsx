import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();

  // Dev-only: allow unauthenticated access to the workflow diagram for local testing/demo.
  // Keeps production behavior unchanged.
  if (import.meta.env.DEV && window.location.pathname === "/architecture") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // CRITICAL: Zero-visibility enforcement — unauthorized emails see nothing
  const email = user.email?.toLowerCase() ?? "";
  const isAllowed = ACCESS_POLICIES.allowedLoginEmails.some(
    (e) => e.toLowerCase() === email
  );

  if (!isAllowed) {
    signOut();
    return null;
  }

  return <>{children}</>;
}
