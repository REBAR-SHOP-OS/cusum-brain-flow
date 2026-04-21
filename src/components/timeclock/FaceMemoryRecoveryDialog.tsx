import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ImageOff, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrphanSample {
  path: string;
  url: string;
  createdAt: string | null;
}

interface OrphanFolder {
  profileId: string;
  photoCount: number;
  lastUpload: string | null;
  samples: OrphanSample[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
}

export function FaceMemoryRecoveryDialog({ open, onOpenChange, onAssigned }: Props) {
  const { profiles } = useProfiles();
  const [orphans, setOrphans] = useState<OrphanFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const fetchOrphans = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("face-recover-orphans?action=list", {
        method: "GET",
      });
      if (error) throw error;
      const list = (data?.data?.orphans ?? data?.orphans ?? []) as OrphanFolder[];
      setOrphans(list);
    } catch (err: any) {
      console.error("[FaceRecovery] list error:", err);
      toast.error(err.message ?? "Failed to load orphan folders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchOrphans();
  }, [open, fetchOrphans]);

  const handleAssign = async (orphanProfileId: string) => {
    const targetProfileId = selections[orphanProfileId];
    if (!targetProfileId) {
      toast.error("Select a person first");
      return;
    }
    setPendingAction(orphanProfileId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "face-recover-orphans?action=assign",
        { method: "POST", body: { orphanProfileId, targetProfileId } },
      );
      if (error) throw error;
      const result = data?.data ?? data;
      toast.success(`Assigned ${result?.assigned ?? 0} photos to ${result?.targetName ?? "user"}`);
      setOrphans((prev) => prev.filter((o) => o.profileId !== orphanProfileId));
      setSelections((prev) => {
        const next = { ...prev };
        delete next[orphanProfileId];
        return next;
      });
      onAssigned?.();
    } catch (err: any) {
      console.error("[FaceRecovery] assign error:", err);
      toast.error(err.message ?? "Failed to assign photos");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (orphanProfileId: string) => {
    if (!confirm("Delete these orphan photos permanently? This cannot be undone.")) return;
    setPendingAction(orphanProfileId);
    try {
      const { error } = await supabase.functions.invoke(
        "face-recover-orphans?action=delete",
        { method: "POST", body: { orphanProfileId } },
      );
      if (error) throw error;
      toast.success("Orphan folder deleted");
      setOrphans((prev) => prev.filter((o) => o.profileId !== orphanProfileId));
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete");
    } finally {
      setPendingAction(null);
    }
  };

  const sortedProfiles = [...profiles]
    .filter((p) => p.is_active)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Recover Orphan Face Photos
          </DialogTitle>
          <DialogDescription>
            These photo folders belong to deleted profiles. Identify each face and reassign to the correct current employee.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : orphans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mb-2 text-green-500" />
              <p className="text-sm">No orphan folders found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orphans.map((orphan) => {
                const isPending = pendingAction === orphan.profileId;
                const selected = selections[orphan.profileId] ?? "";
                return (
                  <div
                    key={orphan.profileId}
                    className={cn(
                      "rounded-lg border border-border bg-card p-4 space-y-3",
                      isPending && "opacity-60 pointer-events-none",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {orphan.profileId.slice(0, 8)}…
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {orphan.photoCount} photo{orphan.photoCount === 1 ? "" : "s"} ·{" "}
                        {orphan.lastUpload ? new Date(orphan.lastUpload).toLocaleDateString() : "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {orphan.samples.length === 0 ? (
                        <div className="col-span-3 flex items-center justify-center h-24 bg-muted/30 rounded">
                          <ImageOff className="w-5 h-5 text-muted-foreground" />
                        </div>
                      ) : (
                        orphan.samples.slice(0, 6).map((s) => (
                          <img
                            key={s.path}
                            src={s.url}
                            alt="face sample"
                            className="aspect-square object-cover rounded border border-border cursor-pointer hover:opacity-90"
                            onClick={() => window.open(s.url, "_blank")}
                          />
                        ))
                      )}
                    </div>

                    <Select
                      value={selected}
                      onValueChange={(val) =>
                        setSelections((prev) => ({ ...prev, [orphan.profileId]: val }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assign to…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedProfiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name}
                            {p.email ? ` (${p.email})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                        disabled={!selected || isPending}
                        onClick={() => handleAssign(orphan.profileId)}
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(orphan.profileId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
