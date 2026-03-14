import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Camera, Loader2, Wifi, WifiOff, Signal,
} from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

const ZONES = [
  "loading_dock", "dispatch_yard", "cutter_area",
  "bender_area", "forklift_lane", "restricted_inventory",
];

interface CameraRow {
  id: string;
  company_id: string;
  camera_id: string;
  name: string;
  ip_address: string;
  port: number;
  username: string;
  password: string | null;
  rtsp_path: string;
  location: string | null;
  assigned_zone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  camera_id: "",
  name: "",
  ip_address: "",
  port: 554,
  username: "admin",
  password: "",
  rtsp_path: "/h264Preview_01_main",
  location: "",
  assigned_zone: "",
  is_active: true,
};

export default function CameraManager() {
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pingStatus, setPingStatus] = useState<Record<string, "untested" | "testing" | "online" | "offline">>({});
  const [pingLatency, setPingLatency] = useState<Record<string, number | null>>({});

  const fetchCameras = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("cameras")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) {
      toast({ title: "Error loading cameras", description: error.message, variant: "destructive" });
    } else {
      setCameras((data as CameraRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCameras(); }, [companyId]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (cam: CameraRow) => {
    setEditingId(cam.id);
    setForm({
      camera_id: cam.camera_id,
      name: cam.name,
      ip_address: cam.ip_address,
      port: cam.port,
      username: cam.username,
      password: cam.password ?? "",
      rtsp_path: cam.rtsp_path,
      location: cam.location ?? "",
      assigned_zone: cam.assigned_zone ?? "",
      is_active: cam.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!form.name.trim() || !form.ip_address.trim() || !form.camera_id.trim()) {
      toast({ title: "Missing fields", description: "Name, Camera ID, and IP Address are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      camera_id: form.camera_id.trim(),
      name: form.name.trim(),
      ip_address: form.ip_address.trim(),
      port: form.port,
      username: form.username.trim(),
      password: form.password || null,
      rtsp_path: form.rtsp_path.trim(),
      location: form.location.trim() || null,
      assigned_zone: form.assigned_zone || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("cameras").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("cameras").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Camera updated" : "Camera added" });
      setDialogOpen(false);
      fetchCameras();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cameras").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Camera deleted" });
      fetchCameras();
    }
  };

  const handleTestConnection = async (cam: CameraRow) => {
    setPingStatus((s) => ({ ...s, [cam.id]: "testing" }));
    try {
      const result = await invokeEdgeFunction<{
        reachable: boolean;
        http_reachable: boolean;
        rtsp_reachable: boolean;
        latency_ms: number | null;
        error?: string;
      }>("camera-ping", { ip_address: cam.ip_address, port: cam.port });

      const status = result.reachable ? "online" : "offline";
      setPingStatus((s) => ({ ...s, [cam.id]: status }));
      setPingLatency((s) => ({ ...s, [cam.id]: result.latency_ms }));

      if (result.reachable) {
        const details = [
          result.http_reachable && "HTTP",
          result.rtsp_reachable && "RTSP",
        ].filter(Boolean).join(" + ");
        toast({ title: `✅ ${cam.name} is online`, description: `Reachable via ${details} (${result.latency_ms}ms)` });
      } else {
        toast({ title: `❌ ${cam.name} is offline`, description: result.error || "Not reachable", variant: "destructive" });
      }
    } catch (err: any) {
      setPingStatus((s) => ({ ...s, [cam.id]: "offline" }));
      toast({ title: "Connection test failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Registered Cameras
          </CardTitle>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Camera
          </Button>
        </CardHeader>
        <CardContent>
          {cameras.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No cameras registered yet. Click "Add Camera" to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Name</TableHead>
                    <TableHead className="text-[10px]">Camera ID</TableHead>
                    <TableHead className="text-[10px]">IP Address</TableHead>
                    <TableHead className="text-[10px]">Location</TableHead>
                    <TableHead className="text-[10px]">Zone</TableHead>
                    <TableHead className="text-[10px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cameras.map((cam) => (
                    <TableRow key={cam.id}>
                      <TableCell>
                        {(() => {
                          const ps = pingStatus[cam.id] || "untested";
                          if (ps === "testing") return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
                          if (ps === "online") return (
                            <div className="flex items-center gap-1">
                              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                              {pingLatency[cam.id] != null && (
                                <span className="text-[9px] text-muted-foreground">{pingLatency[cam.id]}ms</span>
                              )}
                            </div>
                          );
                          if (ps === "offline") return <WifiOff className="w-3.5 h-3.5 text-destructive" />;
                          // untested — show static based on is_active
                          return cam.is_active
                            ? <Wifi className="w-3.5 h-3.5 text-muted-foreground/50" />
                            : <WifiOff className="w-3.5 h-3.5 text-muted-foreground/50" />;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{cam.name}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground font-mono">{cam.camera_id}</TableCell>
                      <TableCell className="text-[10px] font-mono">{cam.ip_address}:{cam.port}</TableCell>
                      <TableCell className="text-[10px]">{cam.location ?? "—"}</TableCell>
                      <TableCell>
                        {cam.assigned_zone ? (
                          <Badge variant="outline" className="text-[9px]">
                            {cam.assigned_zone.replace(/_/g, " ")}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cam)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cam.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Camera" : "Add Camera"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input placeholder="Loading Dock Cam" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Camera ID *</Label>
                <Input placeholder="cam_loading_dock" value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">IP Address *</Label>
                <Input placeholder="192.168.1.100" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Port</Label>
                <Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 554 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RTSP Path</Label>
              <Input value={form.rtsp_path} onChange={(e) => setForm({ ...form, rtsp_path: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input placeholder="Loading Dock" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assigned Zone</Label>
                <Select value={form.assigned_zone} onValueChange={(v) => setForm({ ...form, assigned_zone: v })}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => (
                      <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
