import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export interface ExpenseClaim {
  id: string;
  company_id: string;
  profile_id: string;
  claim_number: string;
  title: string;
  description: string | null;
  status: string;
  total_amount: number;
  currency: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseClaimItem {
  id: string;
  claim_id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
}

export function useExpenseClaims() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["expense-claims", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_claims")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExpenseClaim[];
    },
  });

  const createClaim = useMutation({
    mutationFn: async (input: { title: string; description?: string }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      if (!profile) throw new Error("No profile found");

      const { data, error } = await supabase
        .from("expense_claims")
        .insert({
          company_id: companyId!,
          profile_id: profile.id,
          claim_number: "TEMP", // trigger will overwrite
          title: input.title,
          description: input.description || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
      toast.success("Expense claim created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateClaim = useMutation({
    mutationFn: async (input: { id: string; status?: string; review_note?: string; payment_reference?: string; title?: string; description?: string }) => {
      const updates: any = {};
      if (input.status) updates.status = input.status;
      if (input.status === "submitted") updates.submitted_at = new Date().toISOString();
      if (input.status === "approved" || input.status === "rejected") {
        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user!.id).single();
        updates.reviewed_by = profile?.id;
        updates.reviewed_at = new Date().toISOString();
      }
      if (input.status === "paid") updates.paid_at = new Date().toISOString();
      if (input.review_note !== undefined) updates.review_note = input.review_note;
      if (input.payment_reference !== undefined) updates.payment_reference = input.payment_reference;
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;

      const { error } = await supabase.from("expense_claims").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
      toast.success("Claim updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteClaim = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_claims").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
      toast.success("Claim deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return { claims, isLoading, createClaim, updateClaim, deleteClaim };
}

export function useExpenseClaimItems(claimId: string | null) {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["expense-claim-items", claimId],
    enabled: !!claimId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_claim_items")
        .select("*")
        .eq("claim_id", claimId!)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as ExpenseClaimItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (input: Omit<ExpenseClaimItem, "id" | "created_at">) => {
      const { error } = await supabase.from("expense_claim_items").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-claim-items", claimId] });
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_claim_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-claim-items", claimId] });
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return { items, isLoading, addItem, removeItem };
}
