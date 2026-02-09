import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

/** Routes accessible to workshop-only users (no admin/office/sales roles) */
const WORKSHOP_ALLOWED = [
  "/shop-floor",
  "/shopfloor",
  "/timeclock",
  "/team-hub",
  "/settings",
  "/inbox",
  "/phonecalls",
];

/** Routes accessible to sales-only users */
const SALES_ALLOWED = [
  "/pipeline",
  "/customers",
  "/office",
  "/inbox",
  "/phonecalls",
  "/settings",
  "/home",
  "/brain",
];

interface RoleGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects workshop-only users away from pages they shouldn't access.
 * Admin / office / sales / accounting users pass through freely.
 */
export function RoleGuard({ children }: RoleGuardProps) {
  const { roles, isLoading, isAdmin } = useUserRole();
  const location = useLocation();

  if (isLoading || roles.length === 0) return <>{children}</>;

  // If user has any elevated role, allow everything
  if (isAdmin) return <>{children}</>;
  const hasOfficeAccess = roles.some((r) =>
    ["accounting", "office", "field"].includes(r)
  );
  if (hasOfficeAccess) return <>{children}</>;

  // Sales-only: restrict to CRM + estimating routes
  const isSalesOnly = roles.length === 1 && roles.includes("sales" as any);
  if (isSalesOnly) {
    const isAllowed = SALES_ALLOWED.some((prefix) =>
      location.pathname.startsWith(prefix)
    );
    if (!isAllowed) {
      return <Navigate to="/pipeline" replace />;
    }
    return <>{children}</>;
  }

  // Workshop-only: restrict to allowed routes
  const isAllowed = WORKSHOP_ALLOWED.some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  if (!isAllowed) {
    return <Navigate to="/shop-floor" replace />;
  }

  return <>{children}</>;
}
