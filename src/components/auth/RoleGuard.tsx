import { Navigate, useLocation } from "react-router-dom";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

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
  "/shopfloor/delivery-ops",
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
  "/live-monitor",
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
  const { isSuperAdmin } = useSuperAdmin();
  const location = useLocation();

  const email = user?.email || "";

  // Block specific emails from shop floor routes — even super admins
  if (ACCESS_POLICIES.blockedFromShopFloor.includes(email.toLowerCase()) && (location.pathname.startsWith("/shop-floor") || location.pathname.startsWith("/shopfloor"))) {
    return <Navigate to="/home" replace />;
  }

  // Super admins bypass all other route restrictions
  if (isSuperAdmin) return <>{children}</>;
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

    // External estimator (in externalEstimators map) → Sales Pipeline only
    const isExternalEstimator = !!ACCESS_POLICIES.externalEstimators[email.toLowerCase()];
    if (isExternalEstimator) {
      if (!location.pathname.startsWith("/sales/pipeline")) {
        return <Navigate to="/sales/pipeline" replace />;
      }
      return <>{children}</>;
    }

    // External office role (e.g. Karthick) → Pipeline, Time Clock, Team Hub
    const EXTERNAL_OFFICE_ALLOWED = ["/pipeline", "/timeclock", "/team-hub", "/sales/pipeline"];
    const hasOfficeRole = roles.includes("office" as any);
    if (hasOfficeRole) {
      const isAllowed = EXTERNAL_OFFICE_ALLOWED.some((p) => location.pathname.startsWith(p));
      if (!isAllowed) return <Navigate to="/pipeline" replace />;
      return <>{children}</>;
    }

    // External shop supervisor → extended workshop routes
    const EXTERNAL_SUPERVISOR_ALLOWED = ["/timeclock", "/team-hub", "/shop-floor", "/shopfloor", "/home", "/tasks", "/shopfloor/delivery-ops", "/settings"];
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

  // Block specific emails from /customers (UX gate only — not a security boundary)
  if (ACCESS_POLICIES.blockedFromCustomers.includes(email.toLowerCase()) && location.pathname.startsWith("/customers")) {
    return <Navigate to="/home" replace />;
  }


  // Accounting: email-only access (overrides all roles including admin)
  if (location.pathname.startsWith("/accounting") && !ACCESS_POLICIES.accountingAccess.includes(email.toLowerCase())) {
    return <Navigate to="/home" replace />;
  }

  // Internal users: wait for roles to load
  if (isLoading) return <>{children}</>;

  // Shared shopfloor device accounts — lock to shop routes only (UX gate only)
  if (ACCESS_POLICIES.shopfloorDevices.includes(email.toLowerCase())) {
    const DEVICE_ALLOWED = ["/shopfloor", "/shop-floor", "/timeclock", "/team-hub", "/settings", "/tasks", "/shopfloor/delivery-ops"];
    const isAllowed = DEVICE_ALLOWED.some((p) => location.pathname.startsWith(p));
    if (!isAllowed) return <Navigate to="/shopfloor" replace />;
    return <>{children}</>;
  }

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

  // Internal user with no roles assigned — allow basic access rather than
  // treating them as workshop-only (which redirects to /shop-floor)
  if (roles.length === 0) {
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
