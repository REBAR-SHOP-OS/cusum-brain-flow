import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SystemBackup {
  id: string;
  company_id: string;
  created_by: string | null;
  created_by_name: string | null;
  status: "pending" | "running" | "success" | "failed";
  backup_type: "manual" | "scheduled";
  file_path: string | null;
  file_size_bytes: number | null;
  tables_backed_up: string[] | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

async function callBackupFunction(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/system-backup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export function useBackups() {
  return useQuery<SystemBackup[]>({
    queryKey: ["system_backups"],
    queryFn: async () => {
      const result = await callBackupFunction({ action: "list" });
      return result.backups ?? [];
    },
    staleTime: 30_000,
  });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callBackupFunction({ action: "run" }),
    onSuccess: () => {
      toast.success("Backup completed successfully");
      qc.invalidateQueries({ queryKey: ["system_backups"] });
    },
    onError: (err: Error) => {
      toast.error("Backup failed: " + err.message);
    },
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { backup_id: string; confirm: string }) =>
      callBackupFunction({ action: "restore", ...vars }),
    onSuccess: () => {
      toast.success("Restore complete! The page will reload shortly.");
      qc.invalidateQueries({ queryKey: ["system_backups"] });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (err: Error) => {
      toast.error("Restore failed: " + err.message);
    },
  });
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
