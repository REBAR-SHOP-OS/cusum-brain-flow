import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface AdminRouteProps {
  children: React.ReactNode;
  allowedEmails?: string[];
}

export function AdminRoute({ children, allowedEmails }: AdminRouteProps) {
  const { isAdmin, isLoading } = useUserRole();
  const toasted = useRef(false);
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? "";
  const isAllowed = isAdmin || (allowedEmails?.some(e => e.toLowerCase() === email) ?? false);

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
