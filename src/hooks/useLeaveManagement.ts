import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/hooks/useProfiles";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export interface LeaveBalance {
  id: string;
  profile_id: string;
  year: number;
  vacation_days_entitled: number;
  vacation_days_used: number;
  sick_days_entitled: number;
  sick_days_used: number;
  personal_days_entitled: number;
  personal_days_used: number;
  company_id: string;
}

export interface LeaveRequest {
  id: string;
  profile_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  company_id: string;
  created_at: string;
}

export function useLeaveManagement() {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const { companyId } = useCompanyId();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const myProfile = profiles.find((p) => p.user_id === user?.id);
  const currentYear = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    if (!myProfile) return;
    setLoading(true);

    const [balanceRes, myReqRes, allReqRes] = await Promise.all([
      supabase
        .from("leave_balances")
        .select("*")
        .eq("profile_id", myProfile.id as any)
        .eq("year", currentYear)
        .maybeSingle(),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("profile_id", myProfile.id as any)
        .order("created_at", { ascending: false }),
      supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (balanceRes.data) setBalance(balanceRes.data as any);
    if (myReqRes.data) setMyRequests(myReqRes.data as any);
    if (allReqRes.data) setAllRequests(allReqRes.data as any);
    setLoading(false);
  }, [myProfile, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("leave-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_balances" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const submitRequest = async (data: {
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason?: string;
  }) => {
    if (!myProfile || !companyId) { toast.error("No profile found"); return false; }

    const { error } = await supabase.from("leave_requests").insert({
      profile_id: myProfile.id,
      company_id: companyId,
      ...data,
    } as any);

    if (error) {
      toast.error("Failed to submit request");
      return false;
    }
    toast.success("Leave request submitted!");
    fetchData();
    return true;
  };

  const reviewRequest = async (requestId: string, status: "approved" | "denied", note?: string) => {
    if (!myProfile) return;

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status,
        reviewed_by: myProfile.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      } as any)
      .eq("id", requestId);

    if (error) {
      toast.error(`Failed to ${status} request`);
    } else {
      toast.success(`Request ${status}!`);
      fetchData();
    }
  };

  const cancelRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "cancelled" } as any)
      .eq("id", requestId);

    if (error) toast.error("Failed to cancel request");
    else { toast.success("Request cancelled"); fetchData(); }
  };

  return {
    balance,
    myRequests,
    allRequests,
    loading,
    submitRequest,
    reviewRequest,
    cancelRequest,
    myProfile,
    profiles,
  };
}
