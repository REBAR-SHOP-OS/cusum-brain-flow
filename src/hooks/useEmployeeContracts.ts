import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmployeeContract {
  id: string;
  company_id: string;
  employee_name: string;
  employee_email: string | null;
  position: string;
  department: string | null;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number;
  salary_currency: string;
  pay_frequency: string;
  probation_end_date: string | null;
  notice_period_days: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryHistory {
  id: string;
  contract_id: string;
  effective_date: string;
  previous_salary: number | null;
  new_salary: number;
  reason: string | null;
  created_at: string;
}

export interface EmployeeCertification {
  id: string;
  company_id: string;
  employee_name: string;
  employee_email: string | null;
  certification_name: string;
  issuing_body: string | null;
  certificate_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  reminder_days: number;
  notes: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmployeeContracts() {
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [certifications, setCertifications] = useState<EmployeeCertification[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContracts = useCallback(async () => {
    const { data, error } = await supabase
      .from("employee_contracts")
      .select("*")
      .order("employee_name");
    if (error) { toast.error("Failed to load contracts"); return; }
    setContracts(data || []);
  }, []);

  const loadCertifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("employee_certifications")
      .select("*")
      .order("employee_name");
    if (error) { toast.error("Failed to load certifications"); return; }
    setCertifications(data || []);
  }, []);

  const loadSalaryHistory = useCallback(async (contractId: string) => {
    const { data, error } = await supabase
      .from("salary_history")
      .select("*")
      .eq("contract_id", contractId)
      .order("effective_date", { ascending: false });
    if (error) { toast.error("Failed to load salary history"); return; }
    setSalaryHistory(data || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadContracts(), loadCertifications()]);
    setLoading(false);
  }, [loadContracts, loadCertifications]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createContract = useCallback(async (c: Omit<EmployeeContract, "id" | "created_at" | "updated_at">) => {
    const { error } = await supabase.from("employee_contracts").insert(c as any);
    if (error) { toast.error("Failed to create contract"); return false; }
    toast.success("Contract created");
    loadContracts();
    return true;
  }, [loadContracts]);

  const updateContract = useCallback(async (id: string, updates: Partial<EmployeeContract>) => {
    const { error } = await supabase.from("employee_contracts").update(updates as any).eq("id", id);
    if (error) { toast.error("Failed to update contract"); return false; }
    toast.success("Contract updated");
    loadContracts();
    return true;
  }, [loadContracts]);

  const addSalaryChange = useCallback(async (entry: Omit<SalaryHistory, "id" | "created_at">) => {
    const { error } = await supabase.from("salary_history").insert(entry as any);
    if (error) { toast.error("Failed to record salary change"); return false; }
    toast.success("Salary change recorded");
    // Also update the contract's current salary
    await supabase.from("employee_contracts").update({ salary: entry.new_salary } as any).eq("id", entry.contract_id);
    loadContracts();
    return true;
  }, [loadContracts]);

  const createCertification = useCallback(async (c: Omit<EmployeeCertification, "id" | "created_at" | "updated_at">) => {
    const { error } = await supabase.from("employee_certifications").insert(c as any);
    if (error) { toast.error("Failed to create certification"); return false; }
    toast.success("Certification added");
    loadCertifications();
    return true;
  }, [loadCertifications]);

  const updateCertification = useCallback(async (id: string, updates: Partial<EmployeeCertification>) => {
    const { error } = await supabase.from("employee_certifications").update(updates as any).eq("id", id);
    if (error) { toast.error("Failed to update certification"); return false; }
    toast.success("Certification updated");
    loadCertifications();
    return true;
  }, [loadCertifications]);

  // Compute expiring certifications (within reminder_days of expiry)
  const expiringCerts = certifications.filter(c => {
    if (!c.expiry_date || c.status !== "active") return false;
    const daysUntil = Math.ceil((new Date(c.expiry_date).getTime() - Date.now()) / 86400000);
    return daysUntil <= c.reminder_days && daysUntil >= 0;
  });

  const expiredCerts = certifications.filter(c => {
    if (!c.expiry_date || c.status !== "active") return false;
    return new Date(c.expiry_date) < new Date();
  });

  return {
    contracts, certifications, salaryHistory, loading,
    expiringCerts, expiredCerts,
    loadContracts, loadCertifications, loadSalaryHistory, loadAll,
    createContract, updateContract, addSalaryChange,
    createCertification, updateCertification,
  };
}
