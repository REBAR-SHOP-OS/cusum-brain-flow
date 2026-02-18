import { useState } from "react";
import { format } from "date-fns";
import {
  DatabaseBackup,
  RefreshCw,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBackups,
  useRunBackup,
  useRestoreBackup,
  formatBytes,
  SystemBackup,
} from "@/hooks/useBackups";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function StatusBadge({ status }: { status: SystemBackup["status"] }) {
  if (status === "success") {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
        <CheckCircle className="w-3 h-3" /> Success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
        <XCircle className="w-3 h-3" /> Failed
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Running
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="w-3 h-3" /> Pending
    </Badge>
  );
}

export function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const { data: backups = [], isLoading, refetch } = useBackups();
  const runBackup = useRunBackup();
  const restoreBackup = useRestoreBackup();

  const [restoreTarget, setRestoreTarget] = useState<SystemBackup | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoreStep, setRestoreStep] = useState<
    "confirm" | "restoring" | "done" | "error"
  >("confirm");
  const [restoreError, setRestoreError] = useState("");

  const lastSuccess = backups.find((b) => b.status === "success");

  function openRestoreDialog(backup: SystemBackup) {
    setRestoreTarget(backup);
    setConfirmText("");
    setRestoreStep("confirm");
    setRestoreError("");
  }

  function closeRestoreDialog() {
    setRestoreTarget(null);
    setConfirmText("");
    setRestoreStep("confirm");
    setRestoreError("");
  }

  async function handleRestore() {
    if (!restoreTarget || confirmText !== "RESTORE") return;
    setRestoreStep("restoring");
    try {
      await restoreBackup.mutateAsync({
        backup_id: restoreTarget.id,
        confirm: "RESTORE",
      });
      setRestoreStep("done");
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Unknown error");
      setRestoreStep("error");
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <DatabaseBackup className="w-5 h-5 text-primary" />
              Backup & Restore
            </DialogTitle>
          </DialogHeader>

          {/* Summary row */}
          <div className="shrink-0 grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Last Successful Backup
              </p>
              {lastSuccess ? (
                <p className="text-sm font-medium">
                  {format(new Date(lastSuccess.started_at), "MMM d, yyyy HH:mm")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No backups yet</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Status
              </p>
              {lastSuccess ? (
                <StatusBadge status={lastSuccess.status} />
              ) : (
                <Badge variant="secondary">None</Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex gap-2">
            <Button
              onClick={() => runBackup.mutate()}
              disabled={runBackup.isPending}
              className="gap-2"
            >
              {runBackup.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <DatabaseBackup className="w-4 h-4" />
              )}
              {runBackup.isPending ? "Running Backup…" : "Run Backup Now"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              title="Refresh list"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Backup history table */}
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold px-4 py-2 bg-muted/30 border-b border-border">
              Backup History (last 20)
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <DatabaseBackup className="w-10 h-10 opacity-30" />
                <p className="text-sm">No backups found. Run your first backup above.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {backup.id.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(backup.started_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {backup.backup_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatBytes(backup.file_size_bytes)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={backup.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {backup.created_by_name ?? "System"}
                      </TableCell>
                      <TableCell className="text-right">
                        {backup.status === "success" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7 text-xs"
                            onClick={() => openRestoreDialog(backup)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </Button>
                        )}
                        {backup.status === "failed" && backup.error_message && (
                          <span
                            className="text-xs text-destructive truncate max-w-[120px] block"
                            title={backup.error_message}
                          >
                            {backup.error_message.slice(0, 40)}…
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="shrink-0 text-xs text-muted-foreground">
            Backups are retained for 7 days or up to 50 snapshots. Auto-backup runs every 12 hours.
          </p>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && closeRestoreDialog()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              Restore Database
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm space-y-2">
              <span className="block font-semibold text-foreground">
                ⚠️ This will overwrite ALL current data with the backup from{" "}
                {restoreTarget &&
                  format(new Date(restoreTarget.started_at), "MMM d, yyyy HH:mm")}
                .
              </span>
              <span className="block">
                This action cannot be undone. The system will be temporarily unavailable during restore.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {restoreStep === "confirm" && (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">
                Type <span className="font-mono text-destructive font-bold">RESTORE</span> to confirm:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type RESTORE"
                className="font-mono"
                autoFocus
              />
            </div>
          )}

          {restoreStep === "restoring" && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Restoring data…</p>
                <p className="text-xs text-muted-foreground">
                  This may take a moment. Do not close this window.
                </p>
              </div>
            </div>
          )}

          {restoreStep === "done" && (
            <div className="flex items-center gap-3 py-4 text-primary">
              <CheckCircle className="w-6 h-6" />
              <div>
                <p className="text-sm font-medium">✅ Restore complete.</p>
                <p className="text-xs">Page will reload shortly…</p>
              </div>
            </div>
          )}

          {restoreStep === "error" && (
            <div className="flex items-start gap-3 py-4 text-destructive">
              <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Restore failed</p>
                <p className="text-xs mt-1 break-words">{restoreError}</p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={closeRestoreDialog}
              disabled={restoreStep === "restoring"}
            >
              Cancel
            </AlertDialogCancel>
            {restoreStep === "confirm" && (
              <Button
                variant="destructive"
                onClick={handleRestore}
                disabled={confirmText !== "RESTORE"}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restore Now
              </Button>
            )}
            {restoreStep === "error" && (
              <Button
                variant="destructive"
                onClick={() => setRestoreStep("confirm")}
              >
                Try Again
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
