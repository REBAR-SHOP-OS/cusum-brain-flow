import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useCustomerPortalData() {
  const { user } = useAuth();

  const { data: customerLink, isLoading: linkLoading } = useQuery({
    queryKey: ["customer-link", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_user_links")
        .select("customer_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const customerId = customerLink?.customer_id;

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery({
    queryKey: ["customer-deliveries", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, delivery_stops(*)")
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return {
    customerId,
    orders,
    deliveries,
    isLoading: linkLoading || ordersLoading || deliveriesLoading,
    hasAccess: !!customerLink,
  };
}
