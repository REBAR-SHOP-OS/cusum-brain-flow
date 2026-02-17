import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, isLoading } = useUserRole();
  const toasted = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAdmin && !toasted.current) {
      toasted.current = true;
      toast.error("Access Restricted", { description: "This module is admin-only." });
    }
  }, [isLoading, isAdmin]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
