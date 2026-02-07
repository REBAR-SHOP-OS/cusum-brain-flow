import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Factory,
  Scissors,
  RotateCcw,
  Package,
  Wrench,
  User,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { MachineType, MachineStatus } from "@/types/machine";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MachineRow {
  id: string;
  company_id: string;
  warehouse_id: string | null;
  name: string;
  type: MachineType;
  status: MachineStatus;
  current_run_id: string | null;
  current_operator_profile_id: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OperatorOption {
  id: string;
  full_name: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const typeOptions: { value: MachineType; label: string; icon: React.ElementType }[] = [
  { value: "cutter", label: "Cutter", icon: Scissors },
  { value: "bender", label: "Bender", icon: RotateCcw },
  { value: "loader", label: "Loader", icon: Package },
  { value: "other", label: "Other", icon: Wrench },
];

const statusOptions: { value: MachineStatus; label: string; className: string }[] = [
  { value: "idle", label: "Idle", className: "bg-muted text-muted-foreground" },
  { value: "running", label: "Running", className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" },
  { value: "blocked", label: "Blocked", className: "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]" },
  { value: "down", label: "Down", className: "bg-destructive/15 text-destructive" },
];

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

function useMachinesCRUD() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: machines, isLoading } = useQuery({
    queryKey: ["admin-machines"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("machines")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as MachineRow[];
    },
  });

  const { data: operators } = useQuery({
    queryKey: ["admin-operators"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []) as OperatorOption[];
    },
  });

  // Get company_id from the user's profile
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const createMachine = useMutation({
    mutationFn: async (machine: {
      name: string;
      type: MachineType;
      warehouse_id: string | null;
      status: MachineStatus;
      current_operator_profile_id: string | null;
    }) => {
      const companyId = userProfile?.company_id;
      if (!companyId) throw new Error("No company_id found on your profile");
      const { data, error } = await (supabase as any)
        .from("machines")
        .insert({ ...machine, company_id: companyId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-machines"] }),
  });

  const updateMachine = useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string;
      name?: string;
      type?: MachineType;
      warehouse_id?: string | null;
      status?: MachineStatus;
      current_operator_profile_id?: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("machines")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-machines"] }),
  });

  const deleteMachine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("machines")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-machines"] }),
  });

  return {
    machines: machines ?? [],
    operators: operators ?? [],
    companyId: userProfile?.company_id,
    isLoading,
    createMachine,
    updateMachine,
    deleteMachine,
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminMachines() {
  const { isAdmin, isWorkshop, isLoading: roleLoading } = useUserRole();
  const {
    machines,
    operators,
    isLoading,
    createMachine,
    updateMachine,
    deleteMachine,
  } = useMachinesCRUD();

  const [editingMachine, setEditingMachine] = useState<MachineRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MachineRow | null>(null);

  // owner = admin, supervisor = workshop
  const canCreate = isAdmin;
  const canUpdate = isAdmin || isWorkshop;
  const canDelete = isAdmin;

  const statsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    typeOptions.forEach((t) => {
      counts[t.value] = machines.filter((m) => m.type === t.value).length;
    });
    return counts;
  }, [machines]);

  if (roleLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleSave = async (
    data: {
      name: string;
      type: MachineType;
      warehouse_id: string | null;
      status: MachineStatus;
      current_operator_profile_id: string | null;
    },
    id?: string
  ) => {
    try {
      if (id) {
        await updateMachine.mutateAsync({ id, ...data });
        toast.success("Machine updated");
      } else {
        await createMachine.mutateAsync(data);
        toast.success("Machine created");
      }
      setShowAdd(false);
      setEditingMachine(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save machine");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMachine.mutateAsync(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete machine");
    }
  };

  const getOperatorName = (id: string | null) => {
    if (!id) return "Unassigned";
    return operators.find((o) => o.id === id)?.full_name || "Unknown";
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Factory className="w-6 h-6" />
              Machine Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {canCreate
                ? "Create, update, and manage shop floor machines"
                : canUpdate
                ? "Update machine status and operator assignments"
                : "View machine configurations (read-only)"}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Machine
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {typeOptions.map((t) => {
            const TypeIcon = t.icon;
            return (
              <Card key={t.value} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statsByType[t.value] || 0}</p>
                    <p className="text-xs text-muted-foreground">{t.label}s</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Machine List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : machines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
            <Factory className="w-12 h-12" />
            <p>No machines configured yet</p>
            {canCreate && (
              <Button variant="outline" onClick={() => setShowAdd(true)} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Add your first machine
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {machines.map((machine) => {
              const typeOpt = typeOptions.find((t) => t.value === machine.type);
              const statusOpt = statusOptions.find((s) => s.value === machine.status);
              const TypeIcon = typeOpt?.icon || Wrench;

              return (
                <Card key={machine.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
                      <TypeIcon className="w-5 h-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{machine.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {typeOpt?.label || machine.type}
                        {machine.warehouse_id && ` • WH: ${machine.warehouse_id.slice(0, 8)}…`}
                      </p>
                    </div>

                    <Badge className={statusOpt?.className || "bg-muted text-muted-foreground"}>
                      {statusOpt?.label || machine.status}
                    </Badge>

                    <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[120px]">
                        {getOperatorName(machine.current_operator_profile_id)}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingMachine(machine)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(machine)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <MachineDialog
          open={showAdd || !!editingMachine}
          machine={editingMachine}
          operators={operators}
          canEditAll={isAdmin}
          canUpdate={canUpdate}
          onClose={() => {
            setShowAdd(false);
            setEditingMachine(null);
          }}
          onSave={handleSave}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Machine</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  );
}

/* ------------------------------------------------------------------ */
/*  Machine Dialog                                                     */
/* ------------------------------------------------------------------ */

interface MachineDialogProps {
  open: boolean;
  machine: MachineRow | null;
  operators: OperatorOption[];
  canEditAll: boolean;   // owner: can edit name, type, warehouse
  canUpdate: boolean;    // supervisor: can edit status, operator
  onClose: () => void;
  onSave: (
    data: {
      name: string;
      type: MachineType;
      warehouse_id: string | null;
      status: MachineStatus;
      current_operator_profile_id: string | null;
    },
    id?: string
  ) => Promise<void>;
}

function MachineDialog({
  open,
  machine,
  operators,
  canEditAll,
  canUpdate,
  onClose,
  onSave,
}: MachineDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MachineType>("cutter");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<MachineStatus>("idle");
  const [operatorId, setOperatorId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(machine?.name || "");
      setType(machine?.type || "cutter");
      setWarehouseId(machine?.warehouse_id || "");
      setStatus(machine?.status || "idle");
      setOperatorId(machine?.current_operator_profile_id || "none");
    }
  }, [open, machine]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          type,
          warehouse_id: warehouseId.trim() || null,
          status,
          current_operator_profile_id: operatorId === "none" ? null : operatorId,
        },
        machine?.id
      );
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!machine;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Machine" : "Add Machine"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name — owner only for edit, always for create */}
          <div className="space-y-1.5">
            <Label>Machine Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CNC Cutter #1"
              disabled={isEditing && !canEditAll}
            />
          </div>

          {/* Type — owner only */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as MachineType)}
              disabled={isEditing && !canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warehouse ID — owner only */}
          <div className="space-y-1.5">
            <Label>Warehouse ID</Label>
            <Input
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              placeholder="Optional UUID"
              disabled={isEditing && !canEditAll}
            />
          </div>

          {/* Status — supervisor and owner */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as MachineStatus)}
              disabled={!canUpdate}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operator — supervisor and owner */}
          <div className="space-y-1.5">
            <Label>Assigned Operator</Label>
            <Select
              value={operatorId}
              onValueChange={setOperatorId}
              disabled={!canUpdate}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {canUpdate && (
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEditing ? "Save Changes" : "Create Machine"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
