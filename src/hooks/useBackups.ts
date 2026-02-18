import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SystemBackup {
  id: string;
  company_id: string;
  created_by: string | null;
  created_by_name: string | null;
  status: "pending" | "running" | "success" | "failed";
  backup_type: "manual" | "scheduled" | "imported";
  file_path: string | null;
  file_size_bytes: number | null;
  tables_backed_up: string[] | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface BackupLog {
  id: string;
  backup_id: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  action: string;
  result: string;
  error_message: string | null;
  created_at: string;
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
      qc.invalidateQueries({ queryKey: ["backup_logs"] });
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
      qc.invalidateQueries({ queryKey: ["backup_logs"] });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (err: Error) => {
      toast.error("Restore failed: " + err.message);
    },
  });
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: async (backupId: string) => {
      const result = await callBackupFunction({ action: "download", backup_id: backupId });
      if (result.url) {
        window.open(result.url, "_blank");
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Download started");
    },
    onError: (err: Error) => {
      toast.error("Download failed: " + err.message);
    },
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { backup_id: string; confirm: string }) =>
      callBackupFunction({ action: "delete", ...vars }),
    onSuccess: () => {
      toast.success("Backup deleted permanently");
      qc.invalidateQueries({ queryKey: ["system_backups"] });
      qc.invalidateQueries({ queryKey: ["backup_logs"] });
    },
    onError: (err: Error) => {
      toast.error("Delete failed: " + err.message);
    },
  });
}

export function useImportBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      // Validate JSON structure before sending
      const parsed = JSON.parse(text);
      if (!parsed.version || !parsed.tables) {
        throw new Error("Invalid backup file: must contain 'version' and 'tables'");
      }
      return callBackupFunction({ action: "import", data: text });
    },
    onSuccess: () => {
      toast.success("Backup imported successfully");
      qc.invalidateQueries({ queryKey: ["system_backups"] });
      qc.invalidateQueries({ queryKey: ["backup_logs"] });
    },
    onError: (err: Error) => {
      toast.error("Import failed: " + err.message);
    },
  });
}

export function useBackupLogs() {
  return useQuery<BackupLog[]>({
    queryKey: ["backup_logs"],
    queryFn: async () => {
      const result = await callBackupFunction({ action: "logs" });
      return result.logs ?? [];
    },
    staleTime: 30_000,
  });
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
