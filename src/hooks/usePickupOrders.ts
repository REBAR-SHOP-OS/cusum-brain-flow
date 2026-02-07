import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("pickup_orders")
      .select("*, customer:customers(name, company_name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading pickup orders", description: error.message, variant: "destructive" });
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const authorizeRelease = async (orderId: string, signatureData: string, authorizedBy: string) => {
    const { error } = await supabase
      .from("pickup_orders")
      .update({
        status: "released",
        signature_data: signatureData,
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
  };

  return { orders, loading, fetchOrders, authorizeRelease };
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
      setItems(data || []);
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
