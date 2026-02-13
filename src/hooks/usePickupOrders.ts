import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";

export interface PickupOrder {
  id: string;
  company_id: string;
  customer_id: string | null;
  site_address: string;
  bundle_count: number;
  status: string;
  signature_data: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string; company_name: string | null } | null;
}

export interface PickupOrderItem {
  id: string;
  pickup_order_id: string;
  mark_number: string;
  description: string | null;
  verified: boolean;
  created_at: string;
}

export function usePickupOrders() {
  const { toast } = useToast();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from("pickup_orders")
      .select("*, customer:customers(name, company_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr);
      toast({ title: "Error loading pickup orders", description: fetchErr.message, variant: "destructive" });
    } else {
      setOrders((data as PickupOrder[]) || []);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Fix 5: Realtime subscriptions
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("pickup-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_order_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pickup-items"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, fetchOrders, queryClient]);

  // Fix 3: Store signature in blob storage instead of DB
  const authorizeRelease = async (orderId: string, signatureData: string, authorizedBy: string) => {
    try {
      let signaturePath: string | null = null;

      // Upload signature to storage
      const blob = await (await fetch(signatureData)).blob();
      const path = `${companyId}/signatures/${orderId}-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage
        .from("clearance-photos")
        .upload(path, blob, { contentType: "image/png", upsert: true });

      if (uploadErr) {
        console.error("Signature upload failed, storing inline:", uploadErr.message);
        // Fallback: store inline if upload fails (graceful degradation)
        signaturePath = signatureData;
      } else {
        signaturePath = path;
      }

      const { error } = await supabase
        .from("pickup_orders")
        .update({
          status: "released",
          signature_data: signaturePath,
          authorized_by: authorizedBy,
          authorized_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        toast({ title: "Error authorizing release", description: error.message, variant: "destructive" });
        return false;
      }
      await fetchOrders();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return { orders, loading, error, fetchOrders, authorizeRelease };
}

export function usePickupOrderItems(orderId: string | null) {
  const { toast } = useToast();
  const [items, setItems] = useState<PickupOrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!orderId) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("pickup_order_items")
      .select("*")
      .eq("pickup_order_id", orderId);

    if (error) {
      toast({ title: "Error loading items", description: error.message, variant: "destructive" });
    } else {
      setItems((data as PickupOrderItem[]) || []);
    }
    setLoading(false);
  }, [orderId, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleVerified = async (itemId: string, verified: boolean) => {
    const { error } = await supabase
      .from("pickup_order_items")
      .update({ verified })
      .eq("id", itemId);

    if (error) {
      toast({ title: "Error updating item", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchItems();
    return true;
  };

  return { items, loading, fetchItems, toggleVerified };
}
