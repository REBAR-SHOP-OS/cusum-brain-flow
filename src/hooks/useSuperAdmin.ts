import { useAuth } from "@/lib/auth";

const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop"];

export function useSuperAdmin() {
  const { user } = useAuth();
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email ?? "");
  return { isSuperAdmin };
}
