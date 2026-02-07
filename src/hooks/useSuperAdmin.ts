import { useAuth } from "@/lib/auth";

const SUPER_ADMIN_EMAIL = "sattar@rebar.shop";

export function useSuperAdmin() {
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  return { isSuperAdmin };
}
