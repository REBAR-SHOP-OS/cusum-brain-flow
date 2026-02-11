import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";

/** Routes accessible to workshop-only users (no admin/office/sales roles) */
const WORKSHOP_ALLOWED = [
  "/home",
  "/shop-floor",
  "/shopfloor",
  "/timeclock",
  "/team-hub",
  "/settings",
  "/inbox",
  "/phonecalls",
  "/agent",
  "/tasks",
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
  "/timeclock",
  "/integrations",
  "/agent",
  "/daily-summarizer",
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
  const { user } = useAuth();
  const location = useLocation();

  const email = user?.email || "";
  const isInternal = email.endsWith("@rebar.shop");

  // For external users, check if they're a linked customer
  const { hasAccess: isLinkedCustomer, isLoading: customerLoading } = useCustomerPortalData();

  // External user routing — must run BEFORE role-based checks
  if (!isInternal && email) {
    // Still loading customer link — don't flash wrong page
    if (customerLoading) return <>{children}</>;

    // Linked customer → always go to portal
    if (isLinkedCustomer) {
      return <Navigate to="/portal" replace />;
    }

    // External employee (not a customer) → lock to Time Clock, Team Hub, HR Agent only
    const EXTERNAL_EMPLOYEE_ALLOWED = ["/timeclock", "/team-hub", "/agent/talent"];
    const isAllowedExternal = EXTERNAL_EMPLOYEE_ALLOWED.some((p) =>
      location.pathname.startsWith(p)
    );
    if (!isAllowedExternal) {
      return <Navigate to="/timeclock" replace />;
    }
    return <>{children}</>;
  }

  // Internal users: wait for roles to load
  if (isLoading) return <>{children}</>;

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
