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
      .eq("user_id", user.id)
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

  const refreshSessionIfNeeded = useCallback(async () => {
    const { error } = await supabase.auth.getUser();
    if (error) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        toast.error("Session expired – please log in again");
        await supabase.auth.signOut({ scope: "local" });
        return false;
      }
    }
    return true;
  }, []);

  const addItem = useCallback(async (title: string, quantity = 1, category?: string, priority = "medium", dueDate?: string) => {
    if (!user) return;
    if (!(await refreshSessionIfNeeded())) return false;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
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
      toast.error(`Error adding item: ${error.message}`);
      console.error("addItem error:", error);
      return false;
    }
    toast.success("Item added");
    return true;
  }, [user, refreshSessionIfNeeded]);

  const addItemAsRejected = useCallback(async (title: string, category: string, dueDate?: string) => {
    if (!user) return;
    if (!(await refreshSessionIfNeeded())) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
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
      toast.error(`Error rejecting item: ${error.message}`);
      console.error(error);
    }
  }, [user, refreshSessionIfNeeded]);

  const addItemAsPurchased = useCallback(async (title: string, category: string, dueDate?: string) => {
    if (!user) return;
    if (!(await refreshSessionIfNeeded())) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
    if (!profile?.company_id) return;

    const { error } = await supabase.from("purchasing_list_items").insert({
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
      toast.error(`Error marking item: ${error.message}`);
      console.error(error);
    }
  }, [user, refreshSessionIfNeeded]);

  const togglePurchased = useCallback(async (itemId: string, currentValue: boolean) => {
    if (!user) return;
    if (!(await refreshSessionIfNeeded())) return;
    const { error } = await supabase
      .from("purchasing_list_items")
      .update({
        is_purchased: !currentValue,
        is_rejected: false,
        purchased_by: !currentValue ? user.id : null,
        purchased_at: !currentValue ? new Date().toISOString() : null,
      })
      .eq("id", itemId);
    if (error) {
      toast.error(`Error updating: ${error.message}`);
      console.error(error);
    }
  }, [user, refreshSessionIfNeeded]);

  const toggleRejected = useCallback(async (itemId: string, currentValue: boolean) => {
    if (!user) return;
    if (!(await refreshSessionIfNeeded())) return;
    const { error } = await supabase
      .from("purchasing_list_items")
      .update({
        is_rejected: !currentValue,
        is_purchased: false,
        purchased_by: null,
        purchased_at: null,
      })
      .eq("id", itemId);
    if (error) {
      toast.error(`Error updating item: ${error.message}`);
      console.error(error);
    }
  }, [user, refreshSessionIfNeeded]);

  const deleteItem = useCallback(async (itemId: string) => {
    const { error } = await supabase.from("purchasing_list_items").delete().eq("id", itemId);
    if (error) {
      toast.error("Error deleting");
      console.error(error);
    } else {
      toast.success("Deleted");
    }
  }, []);

  // Confirm list: set due_date on all items without one, then save a snapshot
  const confirmList = useCallback(async (date: string) => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
    if (!profile?.company_id) return;

    // 1. Set due_date on items without one
    const { error } = await supabase
      .from("purchasing_list_items")
      .update({ due_date: date })
      .eq("company_id", profile.company_id)
      .is("due_date", null);
    if (error) {
      toast.error("Error confirming list");
      console.error(error);
      return;
    }

    // 2. Fetch all items for this date to build snapshot
    const { data: allItems } = await supabase
      .from("purchasing_list_items")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("due_date", date);

    const snapshot = (allItems || []).map((item: any) => ({
      title: item.title,
      category: item.category || null,
      quantity: item.quantity,
      status: (item.is_purchased ? "purchased" : item.is_rejected ? "rejected" : "pending") as "purchased" | "rejected" | "pending",
      priority: item.priority,
    }));

    // 3. Save snapshot to purchasing_confirmed_lists
    const { error: snapError } = await supabase
      .from("purchasing_confirmed_lists")
      .insert({
        company_id: profile.company_id,
        confirmed_by: user.id,
        due_date: date,
        snapshot,
      });
    if (snapError) {
      console.error("Snapshot save error:", snapError);
      toast.error("List confirmed but snapshot failed to save");
      return null;
    } else {
      toast.success(`List confirmed for ${date}`);
      return { due_date: date, confirmed_at: new Date().toISOString(), snapshot };
    }
  }, [user]);

  const resetItems = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
    if (!profile?.company_id) return;
    await supabase.from("purchasing_list_items").delete()
      .eq("company_id", profile.company_id)
      .is("due_date", null);
  }, [user]);

  return { items, loading, addItem, addItemAsPurchased, addItemAsRejected, togglePurchased, toggleRejected, deleteItem, confirmList, resetItems, refetch: fetchItems };
}
}
