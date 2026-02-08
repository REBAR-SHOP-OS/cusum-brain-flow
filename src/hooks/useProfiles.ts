import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface Profile {
  id: string;
  user_id: string | null;
  full_name: string;
  title: string | null;
  department: string | null;
  duties: string[];
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSalary {
  id: string;
  profile_id: string;
  salary_amount: number;
  salary_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Profile> & { id: string }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Profile updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating profile", description: err.message, variant: "destructive" });
    },
  });

  const createProfile = useMutation({
    mutationFn: async (profile: Omit<Profile, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("profiles")
        .insert(profile)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Employee added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding employee", description: err.message, variant: "destructive" });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Employee removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error removing employee", description: err.message, variant: "destructive" });
    },
  });

  return { profiles: profiles ?? [], isLoading, updateProfile, createProfile, deleteProfile };
}

export function useSalaries() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { companyId: myCompanyId } = useCompanyId();

  const { data: salaries, isLoading } = useQuery({
    queryKey: ["employee_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salaries")
        .select("*");
      if (error) {
        // Non-admin users will get a permission error — return empty
        if (error.code === "42501" || error.message?.includes("policy")) return [];
        throw error;
      }
      return data as EmployeeSalary[];
    },
  });

  const upsertSalary = useMutation({
    mutationFn: async (salary: Omit<EmployeeSalary, "id" | "created_at" | "updated_at" | "company_id">) => {
      if (!myCompanyId) throw new Error("Company ID not found");
      const { data, error } = await supabase
        .from("employee_salaries")
        .upsert({ ...salary, company_id: myCompanyId }, { onConflict: "profile_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_salaries"] });
      toast({ title: "Salary updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating salary", description: err.message, variant: "destructive" });
    },
  });

  return { salaries: salaries ?? [], isLoading, upsertSalary };
}
