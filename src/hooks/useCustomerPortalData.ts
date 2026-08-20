import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface PortalInvoice {
  id: string;
  quickbooks_id: string;
  balance: number | null;
  data: any;
  last_synced_at: string | null;
}

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
        .select("*, delivery_stops!inner(*)")
        .eq("delivery_stops.customer_id", customerId!)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["customer-invoices", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_mirror")
        .select("id, quickbooks_id, balance, data, last_synced_at")
        .eq("customer_id", customerId!)
        .eq("entity_type", "Invoice")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PortalInvoice[];
    },
  });

  const { data: packingSlips = [], isLoading: slipsLoading } = useQuery({
    queryKey: ["customer-packing-slips", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      // Get customer name from orders to match packing slips
      if (orders.length === 0) return [];
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("id", customerId!)
        .single();
      if (!customer) return [];
      const { data, error } = await supabase
        .from("packing_slips")
        .select("*")
        .ilike("customer_name", `%${customer.name}%`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return {
    customerId,
    orders,
    deliveries,
    invoices,
    packingSlips,
    isLoading: linkLoading || ordersLoading || deliveriesLoading || invoicesLoading || slipsLoading,
    hasAccess: !!customerLink,
  };
}
