import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from "date-fns";

export interface PayrollDailySnapshot {
  id: string;
  profile_id: string;
  work_date: string;
  employee_type: string;
  raw_clock_in: string | null;
  raw_clock_out: string | null;
  lunch_deducted_minutes: number;
  paid_break_minutes: number;
  expected_minutes: number;
  paid_minutes: number;
  overtime_minutes: number;
  exceptions: any[];
  ai_notes: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  company_id: string;
  created_at: string;
}

export interface PayrollWeeklySummary {
  id: string;
  profile_id: string;
  week_start: string;
  week_end: string;
  employee_type: string;
  total_paid_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_exceptions: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  locked_at: string | null;
  company_id: string;
  created_at: string;
}

export function usePayrollAudit() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const targetWeek = weekOffset === 0 ? now : addWeeks(now, weekOffset);
  const weekStart = format(startOfWeek(targetWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(targetWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const prevWeek = () => setWeekOffset((o) => o - 1);
  const nextWeek = () => setWeekOffset((o) => o + 1);
  const currentWeek = () => setWeekOffset(0);

  // Fetch daily snapshots for the week
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ["payroll_snapshots", companyId, weekStart],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("payroll_daily_snapshot" as any)
        .select("*")
        .eq("company_id", companyId)
        .gte("work_date", weekStart)
        .lte("work_date", weekEnd)
        .order("work_date");
      if (error) throw error;
      return (data as unknown) as PayrollDailySnapshot[];
    },
    enabled: !!companyId,
  });

  // Fetch weekly summaries
  const { data: weeklySummaries, isLoading: summariesLoading } = useQuery({
    queryKey: ["payroll_weekly", companyId, weekStart],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("payroll_weekly_summary" as any)
        .select("*")
        .eq("company_id", companyId)
        .eq("week_start", weekStart);
      if (error) throw error;
      return (data as unknown) as PayrollWeeklySummary[];
    },
    enabled: !!companyId,
  });

  // Fetch locked history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["payroll_history", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("payroll_weekly_summary" as any)
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "locked")
        .order("week_start", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as unknown) as PayrollWeeklySummary[];
    },
    enabled: !!companyId,
  });

  // Compute payroll
  const computePayroll = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { data, error } = await supabase.functions.invoke("payroll-engine", {
        body: { company_id: companyId, week_start: weekStart },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payroll_snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["payroll_weekly"] });
      toast.success(`Payroll computed — ${data.employees_processed} employees processed`);
    },
    onError: (err: Error) => {
      toast.error("Failed to compute payroll: " + err.message);
    },
  });

  // Approve employee week
  const approveEmployee = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("payroll_weekly_summary" as any)
        .update({ status: "approved", approved_at: new Date().toISOString() } as any)
        .eq("profile_id", profileId)
        .eq("week_start", weekStart);
      if (error) throw error;

      // Log to audit
      await supabase.from("payroll_audit_log" as any).insert({
        actor_id: user?.id,
        action: "approve_employee_week",
        entity_type: "payroll_weekly_summary",
        entity_id: profileId,
        after_data: { week_start: weekStart, status: "approved" },
        company_id: companyId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_weekly"] });
      toast.success("Employee week approved");
    },
  });

  // Approve all clean
  const approveAllClean = useMutation({
    mutationFn: async () => {
      const clean = (weeklySummaries || []).filter((s) => s.total_exceptions === 0 && s.status === "draft");
      for (const s of clean) {
        await supabase
          .from("payroll_weekly_summary" as any)
          .update({ status: "approved", approved_at: new Date().toISOString() } as any)
          .eq("id", s.id);
      }
      // Audit log
      await supabase.from("payroll_audit_log" as any).insert({
        actor_id: user?.id,
        action: "approve_all_clean",
        entity_type: "payroll_weekly_summary",
        entity_id: "00000000-0000-0000-0000-000000000000",
        after_data: { week_start: weekStart, count: clean.length },
        company_id: companyId,
      } as any);
      return clean.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["payroll_weekly"] });
      toast.success(`${count} clean employees approved`);
    },
  });

  // Lock week
  const lockWeek = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payroll_weekly_summary" as any)
        .update({ status: "locked", locked_at: new Date().toISOString() } as any)
        .eq("company_id", companyId)
        .eq("week_start", weekStart);
      if (error) throw error;

      await supabase.from("payroll_audit_log" as any).insert({
        actor_id: user?.id,
        action: "lock_week",
        entity_type: "payroll_weekly_summary",
        entity_id: "00000000-0000-0000-0000-000000000000",
        after_data: { week_start: weekStart },
        company_id: companyId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_weekly"] });
      queryClient.invalidateQueries({ queryKey: ["payroll_history"] });
      toast.success("Payroll week locked — snapshot is now immutable");
    },
  });

  const isLocked = (weeklySummaries || []).some((s) => s.status === "locked");

  return {
    weekStart,
    weekEnd,
    prevWeek,
    nextWeek,
    currentWeek,
    snapshots: snapshots || [],
    weeklySummaries: weeklySummaries || [],
    history: history || [],
    isLoading: snapshotsLoading || summariesLoading,
    historyLoading,
    computePayroll,
    approveEmployee,
    approveAllClean,
    lockWeek,
    isLocked,
  };
}
