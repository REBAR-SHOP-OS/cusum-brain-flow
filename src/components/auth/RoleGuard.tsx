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
  "/phonecalls",
  "/agent",
  "/tasks",
];

/** Routes accessible to shop supervisors (workshop + extras) */
const SHOP_SUPERVISOR_ALLOWED = [
  ...WORKSHOP_ALLOWED,
  "/deliveries",
];

/** Routes accessible to sales-only users */
const SALES_ALLOWED = [
  "/pipeline",
  "/customers",
  "/office",
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
  const { roles, isLoading, isAdmin, isShopSupervisor, isCustomer } = useUserRole();
  const { user } = useAuth();
  const location = useLocation();

  const email = user?.email || "";
  const isInternal = email.endsWith("@rebar.shop");

  // For external users, check if they're a linked customer
  const { hasAccess: isLinkedCustomer, isLoading: customerLoading } = useCustomerPortalData();

  // External user routing — must run BEFORE internal role-based checks
  if (!isInternal && email) {
    // Still loading customer link or roles — don't flash wrong page
    if (customerLoading || isLoading) return <>{children}</>;

    // Linked customer → always go to portal
    if (isLinkedCustomer) {
      return <Navigate to="/portal" replace />;
    }

    // Customer role → portal only
    if (isCustomer) {
      if (!location.pathname.startsWith("/portal")) {
        return <Navigate to="/portal" replace />;
      }
      return <>{children}</>;
    }

    // External office role (e.g. Karthick) → Pipeline, Time Clock, Team Hub
    const EXTERNAL_OFFICE_ALLOWED = ["/pipeline", "/timeclock", "/team-hub"];
    const hasOfficeRole = roles.includes("office" as any);
    if (hasOfficeRole) {
      const isAllowed = EXTERNAL_OFFICE_ALLOWED.some((p) => location.pathname.startsWith(p));
      if (!isAllowed) return <Navigate to="/pipeline" replace />;
      return <>{children}</>;
    }

    // External shop supervisor → extended workshop routes
    const EXTERNAL_SUPERVISOR_ALLOWED = ["/timeclock", "/team-hub", "/shop-floor", "/shopfloor", "/home", "/tasks", "/deliveries", "/settings"];
    if (isShopSupervisor) {
      const isAllowed = EXTERNAL_SUPERVISOR_ALLOWED.some((p) => location.pathname.startsWith(p));
      if (!isAllowed) return <Navigate to="/shop-floor" replace />;
      return <>{children}</>;
    }

    // External workshop employee → Time Clock & Team Hub only
    const EXTERNAL_WORKSHOP_ALLOWED = ["/timeclock", "/team-hub"];
    const isAllowedExt = EXTERNAL_WORKSHOP_ALLOWED.some((p) => location.pathname.startsWith(p));
    if (!isAllowedExt) return <Navigate to="/timeclock" replace />;
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

  // Customer role → portal only
  if (isCustomer && roles.length === 1) {
    if (!location.pathname.startsWith("/portal")) {
      return <Navigate to="/portal" replace />;
    }
    return <>{children}</>;
  }

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

  // Shop Supervisor: workshop routes + extras
  if (isShopSupervisor && !roles.some((r) => ["admin", "office", "accounting", "sales"].includes(r))) {
    const isAllowed = SHOP_SUPERVISOR_ALLOWED.some((prefix) =>
      location.pathname.startsWith(prefix)
    );
    if (!isAllowed) {
      return <Navigate to="/shop-floor" replace />;
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
