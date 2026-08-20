import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  received_qty: number;
  billed_qty: number;
}

export interface GoodsReceipt {
  id: string;
  company_id: string;
  purchase_order_id: string;
  receipt_number: string;
  received_date: string;
  received_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface ThreeWayMatch {
  id: string;
  company_id: string;
  purchase_order_id: string;
  goods_receipt_id: string | null;
  bill_quickbooks_id: string | null;
  match_status: string;
  qty_variance: number;
  price_variance: number;
  auto_matched: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useThreeWayMatching() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery({
    queryKey: ["purchase-orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: poItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["po-items", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*");
      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ["goods-receipts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_receipts")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GoodsReceipt[];
    },
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ["three-way-matches", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("three_way_matches")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ThreeWayMatch[];
    },
  });

  const createMatch = useMutation({
    mutationFn: async (input: { purchase_order_id: string; goods_receipt_id?: string; bill_quickbooks_id?: string; notes?: string }) => {
      const { error } = await supabase.from("three_way_matches").insert({
        company_id: companyId!,
        purchase_order_id: input.purchase_order_id,
        goods_receipt_id: input.goods_receipt_id || null,
        bill_quickbooks_id: input.bill_quickbooks_id || null,
        notes: input.notes || null,
        match_status: input.goods_receipt_id && input.bill_quickbooks_id ? "matched" : "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["three-way-matches"] });
      toast.success("Match record created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMatch = useMutation({
    mutationFn: async (input: { id: string; match_status: string; notes?: string }) => {
      const updates: any = { match_status: input.match_status };
      if (input.match_status === "approved" || input.match_status === "rejected") {
        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user!.id).single();
        updates.reviewed_by = profile?.id;
        updates.reviewed_at = new Date().toISOString();
      }
      if (input.notes !== undefined) updates.notes = input.notes;
      const { error } = await supabase.from("three_way_matches").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["three-way-matches"] });
      toast.success("Match updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const createReceipt = useMutation({
    mutationFn: async (input: { purchase_order_id: string; notes?: string }) => {
      const { data, error } = await supabase.from("goods_receipts").insert({
        company_id: companyId!,
        purchase_order_id: input.purchase_order_id,
        receipt_number: "TEMP",
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Goods receipt created");
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    purchaseOrders,
    poItems,
    receipts,
    matches,
    isLoading: posLoading || itemsLoading || receiptsLoading || matchesLoading,
    createMatch,
    updateMatch,
    createReceipt,
  };
}
