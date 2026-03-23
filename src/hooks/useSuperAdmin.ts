import { useAuth } from "@/lib/auth";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";

export function useSuperAdmin() {
  const { user } = useAuth();
  const isSuperAdmin = (ACCESS_POLICIES.superAdmins as readonly string[]).includes(user?.email ?? "");
  return { isSuperAdmin };
}
