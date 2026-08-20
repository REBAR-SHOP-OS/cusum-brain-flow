import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface VendorBill {
  id: string;
  quickbooks_id: string;
  balance: number | null;
  data: any;
  last_synced_at: string | null;
}

export function useVendorPortalData() {
  const { user } = useAuth();

  const { data: vendorLink, isLoading: linkLoading } = useQuery({
    queryKey: ["vendor-link", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_user_links")
        .select("vendor_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const vendorId = vendorLink?.vendor_id;

  // Fetch vendor details
  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor-detail", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", vendorId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch bills from accounting_mirror
  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ["vendor-bills", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_mirror")
        .select("id, quickbooks_id, balance, data, last_synced_at")
        .eq("customer_id", vendorId!)
        .eq("entity_type", "Bill")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as VendorBill[];
    },
  });

  // Fetch bill payments from accounting_mirror
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["vendor-payments", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_mirror")
        .select("id, quickbooks_id, balance, data, last_synced_at")
        .eq("customer_id", vendorId!)
        .eq("entity_type", "BillPayment")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as VendorBill[];
    },
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery<any[]>({
    queryKey: ["vendor-purchase-orders", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const res = await (supabase
        .from("purchase_orders") as any)
        .select("id, po_number, status, total_amount, created_at, vendor_id")
        .eq("vendor_id", vendorId!);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  return {
    vendorId,
    vendor,
    bills,
    payments,
    purchaseOrders,
    isLoading: linkLoading || vendorLoading || billsLoading || paymentsLoading || poLoading,
    hasAccess: !!vendorLink,
  };
}
