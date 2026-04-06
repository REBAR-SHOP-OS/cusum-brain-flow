import { Navigate } from "react-router-dom";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface AdminRouteProps {
  children: React.ReactNode;
  /** @deprecated Use allowedRoles — enforced in DB via user_roles + RLS */
  allowedEmails?: string[];
  /** If set, user must be admin OR have one of these roles (matches Edge requireAnyRole) */
  allowedRoles?: AppRole[];
}

export function AdminRoute({ children, allowedEmails, allowedRoles }: AdminRouteProps) {
  const { isAdmin, isLoading, hasRole } = useUserRole();
  const toasted = useRef(false);
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? "";
  const emailLegacy =
    allowedEmails && allowedEmails.length > 0
      ? allowedEmails.some((e) => e.toLowerCase() === email)
      : false;
  const roleOk =
    allowedRoles && allowedRoles.length > 0 ? allowedRoles.some((r) => hasRole(r)) : false;
  const isAllowed = isAdmin || emailLegacy || roleOk;

  useEffect(() => {
    if (!isLoading && !isAllowed && !toasted.current) {
      toasted.current = true;
      toast.error("Access Restricted", { description: "This module is admin-only." });
    }
  }, [isLoading, isAllowed]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  if (!isAllowed) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
