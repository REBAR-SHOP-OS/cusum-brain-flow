import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface PurchasingItem {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  is_purchased: boolean;
  is_rejected: boolean;
  purchased_by: string | null;
  purchased_at: string | null;
  due_date: string | null;
  priority: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
}

export function usePurchasingList(filterDate?: Date, filterStatus?: "all" | "pending" | "purchased") {
  const [items, setItems] = useState<PurchasingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchItems = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    // Get company_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!profile?.company_id) { setLoading(false); return; }

    let query = supabase
      .from("purchasing_list_items")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (filterStatus === "pending") {
      query = query.eq("is_purchased", false);
    } else if (filterStatus === "purchased") {
      query = query.eq("is_purchased", true);
    }

    if (filterDate) {
      const dateStr = filterDate.toISOString().split("T")[0];
      query = query.eq("due_date", dateStr);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching purchasing list:", error);
    } else {
      setItems((data || []) as unknown as PurchasingItem[]);
    }
    setLoading(false);
  }, [user, filterDate, filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("purchasing_list_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchasing_list_items" }, () => {
        fetchItems();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchItems]);

  const addItem = useCallback(async (title: string, quantity = 1, category?: string, priority = "medium", dueDate?: string) => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile?.company_id) return;

    const { error } = await supabase.from("purchasing_list_items").insert({
      company_id: profile.company_id,
      title,
      quantity,
      category: category || null,
      priority,
      due_date: dueDate || null,
      created_by: user.id,
    });
    if (error) {
      toast.error("Error adding item");
      console.error("addItem error:", error);
      return false;
    }
    toast.success("Item added");
    return true;
  }, [user]);

  const addItemAsRejected = useCallback(async (title: string, category: string, dueDate?: string) => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile?.company_id) return;

    const { error } = await supabase.from("purchasing_list_items").insert({
      company_id: profile.company_id,
      title,
      quantity: 1,
      category,
      priority: "medium",
      is_rejected: true,
      is_purchased: false,
      created_by: user.id,
      due_date: dueDate || null,
    });
    if (error) {
      toast.error("Error rejecting item");
      console.error(error);
    }
  }, [user]);

  const addItemAsPurchased = useCallback(async (title: string, category: string, dueDate?: string) => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile?.company_id) return;

    const { error } = await supabase.from("purchasing_list_items" as any).insert({
      company_id: profile.company_id,
      title,
      quantity: 1,
      category,
      priority: "medium",
      is_purchased: true,
      purchased_by: user.id,
      purchased_at: new Date().toISOString(),
      created_by: user.id,
      due_date: dueDate || null,
    });
    if (error) {
      toast.error("Error marking item");
      console.error(error);
    }
  }, [user]);

  const togglePurchased = useCallback(async (itemId: string, currentValue: boolean) => {
    if (!user) return;
    const updateData: any = {
      is_purchased: !currentValue,
      is_rejected: false,
      purchased_by: !currentValue ? user.id : null,
      purchased_at: !currentValue ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("purchasing_list_items" as any).update(updateData).eq("id", itemId);
    if (error) {
      toast.error("Error updating");
      console.error(error);
    }
  }, [user]);

  const toggleRejected = useCallback(async (itemId: string, currentValue: boolean) => {
    if (!user) return;
    const updateData: any = {
      is_rejected: !currentValue,
      is_purchased: false,
      purchased_by: null,
      purchased_at: null,
    };
    const { error } = await supabase.from("purchasing_list_items" as any).update(updateData).eq("id", itemId);
    if (error) {
      toast.error("Error updating");
      console.error(error);
    }
  }, [user]);

  const deleteItem = useCallback(async (itemId: string) => {
    const { error } = await supabase.from("purchasing_list_items" as any).delete().eq("id", itemId);
    if (error) {
      toast.error("Error deleting");
      console.error(error);
    } else {
      toast.success("Deleted");
    }
  }, []);

  // Confirm list: set due_date on all items without one for the current company
  const confirmList = useCallback(async (date: string) => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile?.company_id) return;

    const { error } = await supabase
      .from("purchasing_list_items" as any)
      .update({ due_date: date })
      .eq("company_id", profile.company_id)
      .is("due_date", null);
    if (error) {
      toast.error("Error confirming list");
      console.error(error);
    } else {
      toast.success(`List confirmed for ${date}`);
    }
  }, [user]);

  return { items, loading, addItem, addItemAsPurchased, addItemAsRejected, togglePurchased, toggleRejected, deleteItem, confirmList, refetch: fetchItems };
}
