import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "sales" | "accounting" | "office" | "workshop" | "field";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });

  const hasRole = (role: AppRole) => roles?.includes(role) ?? false;
  const isAdmin = hasRole("admin");
  const isOffice = hasRole("office") || hasRole("sales") || hasRole("accounting");
  const isWorkshop = hasRole("workshop");
  const isField = hasRole("field");

  return {
    roles: roles ?? [],
    isLoading,
    hasRole,
    isAdmin,
    isOffice,
    isWorkshop,
    isField,
  };
}
