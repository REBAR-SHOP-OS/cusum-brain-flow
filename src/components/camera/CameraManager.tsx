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
  Plus, Pencil, Trash2, Camera, Loader2, Wifi, WifiOff, Signal, ScanLine,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import QRCameraScanner from "./QRCameraScanner";
import BulkAddCameras from "./BulkAddCameras";
import { parseReolinkQr } from "@/lib/parseReolinkQr";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { isPrivateIp, browserPing } from "@/lib/browserPing";

const ZONES = [
  "loading_dock", "dispatch_yard", "cutter_area",
  "bender_area", "forklift_lane", "restricted_inventory",
  "front_door",
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
  rtsp_path_secondary?: string | null;
  location: string | null;
  assigned_zone: string | null;
  is_active: boolean;
  brand?: string | null;
  model?: string | null;
  uid?: string | null;
  http_port?: number | null;
  https_port?: number | null;
  online_offline_status?: string | null;
  api_status?: string | null;
  stream_status?: string | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectionTestResult {
  http: boolean | null;
  https: boolean | null;
  rtsp: boolean | null;
  credentials: boolean | null;
  rtsp_path: boolean | null;
  latency_ms: number | null;
  error?: string;
}

const EMPTY_FORM = {
  camera_id: "",
  name: "",
  ip_address: "",
  port: 554,
  http_port: 80,
  https_port: 443,
  username: "admin",
  password: "",
  rtsp_path: "/h264Preview_01_sub",
  rtsp_path_secondary: "/h264Preview_01_main",
  location: "",
  assigned_zone: "",
  is_active: true,
  brand: "",
  model: "",
  uid: "",
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
  const [pingMethod, setPingMethod] = useState<Record<string, string>>({});
  const [agentUrl, setAgentUrl] = useState(() => localStorage.getItem("camera_agent_url") || "");
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [dialogTestResult, setDialogTestResult] = useState<ConnectionTestResult | null>(null);
  const [dialogTesting, setDialogTesting] = useState(false);

  const handleQrScanned = (raw: string) => {
    const parsed = parseReolinkQr(raw);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      camera_id: parsed.uid ?? "",
      name: parsed.uid ? `Camera-${parsed.uid.slice(-6)}` : "",
      username: parsed.username ?? EMPTY_FORM.username,
      password: parsed.password ?? EMPTY_FORM.password,
      ip_address: parsed.ip_address ?? EMPTY_FORM.ip_address,
      port: parsed.port ?? EMPTY_FORM.port,
    });
    setDialogOpen(true);
    setDialogTestResult(null);
    const fields = Object.keys(parsed).filter(k => (parsed as any)[k] != null);
    toast({ title: "QR scanned", description: `Extracted: ${fields.join(", ")}` });
  };

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
    setDialogTestResult(null);
    setDialogOpen(true);
  };

  const openEdit = (cam: CameraRow) => {
    setEditingId(cam.id);
    setForm({
      camera_id: cam.camera_id,
      name: cam.name,
      ip_address: cam.ip_address,
      port: cam.port,
      http_port: (cam as any).http_port ?? 80,
      https_port: (cam as any).https_port ?? 443,
      username: cam.username,
      password: "",  // never show stored password
      rtsp_path: cam.rtsp_path,
      rtsp_path_secondary: cam.rtsp_path_secondary ?? "/h264Preview_01_main",
      location: cam.location ?? "",
      assigned_zone: cam.assigned_zone ?? "",
      is_active: cam.is_active,
      brand: (cam as any).brand ?? "",
      model: (cam as any).model ?? "",
      uid: (cam as any).uid ?? "",
    });
    setDialogTestResult(null);
    setDialogOpen(true);
  };

  const zoneMissing = !form.assigned_zone;

  const handleSave = async () => {
    if (!companyId) return;
    if (!form.name.trim() || !form.ip_address.trim() || !form.camera_id.trim()) {
      toast({ title: "Missing fields", description: "Name, Camera ID, and IP Address are required.", variant: "destructive" });
      return;
    }
    if (zoneMissing) {
      toast({ title: "Zone required", description: "Assigned Zone is required before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      company_id: companyId,
      camera_id: form.camera_id.trim(),
      name: form.name.trim(),
      ip_address: form.ip_address.trim(),
      port: form.port,
      http_port: form.http_port,
      https_port: form.https_port,
      username: form.username.trim(),
      rtsp_path: form.rtsp_path.trim(),
      rtsp_path_secondary: form.rtsp_path_secondary?.trim() || null,
      location: form.location.trim() || null,
      assigned_zone: form.assigned_zone || null,
      is_active: form.is_active,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      uid: form.uid.trim() || null,
      updated_at: new Date().toISOString(),
    };
    // Only include password if user typed a new one
    if (form.password) {
      payload.password = form.password;
    }

    let error;
    if (editingId) {
      ({ error } = await supabase.from("cameras").update(payload).eq("id", editingId));
    } else {
      if (!form.password) {
        toast({ title: "Password required", description: "Password is required for new cameras.", variant: "destructive" });
        setSaving(false);
        return;
      }
      payload.password = form.password;
      ({ error } = await supabase.from("cameras").insert(payload as any));
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

  const saveAgentUrl = (url: string) => {
    setAgentUrl(url);
    localStorage.setItem("camera_agent_url", url);
  };

  /** Full connection test from inside dialog (tests HTTP, HTTPS, RTSP) */
  const handleDialogTestConnection = async () => {
    if (!form.ip_address.trim()) {
      toast({ title: "IP required", description: "Enter an IP address first.", variant: "destructive" });
      return;
    }
    setDialogTesting(true);
    setDialogTestResult(null);

    const result: ConnectionTestResult = {
      http: null, https: null, rtsp: null,
      credentials: null, rtsp_path: null, latency_ms: null,
    };

    try {
      const ip = form.ip_address.trim();
      const privateIp = isPrivateIp(ip);

      // 1. Try browser ping first for private IPs
      if (privateIp) {
        const bp = await browserPing(ip, form.http_port || 80);
        result.http = bp.reachable;
        result.latency_ms = bp.latency_ms;
        if (bp.reachable) {
          // Browser confirmed HTTP reachable on LAN
          result.error = undefined;
          setDialogTestResult(result);
          setDialogTesting(false);
          return;
        }
      }

      // 2. Try local agent if configured
      if (agentUrl) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(`${agentUrl}/agent/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ip_address: ip,
              port: form.port,
              http_port: form.http_port,
              https_port: form.https_port,
              check_rtsp: true,
              username: form.username.trim(),
              password: form.password,
              rtsp_path: form.rtsp_path.trim(),
            }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (resp.ok) {
            const r = await resp.json();
            result.http = r.http_reachable ?? null;
            result.https = r.https_reachable ?? null;
            result.rtsp = r.rtsp_reachable ?? null;
            result.credentials = r.credentials_valid ?? null;
            result.rtsp_path = r.rtsp_path_valid ?? null;
            result.latency_ms = r.latency_ms ?? null;
            if (r.rtsp_reachable === false) {
              result.error = "RTSP is disabled on the camera. Enable RTSP in Reolink Server Settings before using AI monitoring.";
            }
            setDialogTestResult(result);
            setDialogTesting(false);
            return;
          }
        } catch {
          // fall through to cloud
        }
      }

      // 3. Skip cloud for private IPs — it can never reach them
      if (privateIp) {
        result.error = "Private IP — browser ping failed. Configure a Local Agent (click Agent button) for full RTSP/credential testing on your LAN.";
        setDialogTestResult(result);
        setDialogTesting(false);
        return;
      }

      // 4. Cloud fallback (public IPs only)
      const r = await invokeEdgeFunction<{
        reachable: boolean;
        http_reachable: boolean;
        rtsp_reachable: boolean;
        latency_ms: number | null;
        error?: string;
      }>("camera-ping", {
        ip_address: ip,
        port: form.port,
      });

      result.http = r.http_reachable;
      result.rtsp = r.rtsp_reachable;
      result.latency_ms = r.latency_ms;
      if (!r.rtsp_reachable) {
        result.error = "RTSP is disabled on the camera. Enable RTSP in Reolink Server Settings before using AI monitoring.";
      }
      setDialogTestResult(result);
    } catch (err: any) {
      result.error = err.message || "Connection test failed";
      setDialogTestResult(result);
    }
    setDialogTesting(false);
  };

  /** Table-level test (existing) */
  const handleTestConnection = async (cam: CameraRow) => {
    setPingStatus((s) => ({ ...s, [cam.id]: "testing" }));

    const setResult = (reachable: boolean, latency: number | null, method: string, details?: string, error?: string) => {
      const status = reachable ? "online" : "offline";
      setPingStatus((s) => ({ ...s, [cam.id]: status }));
      setPingLatency((s) => ({ ...s, [cam.id]: latency }));
      setPingMethod((s) => ({ ...s, [cam.id]: method }));
      if (reachable) {
        toast({ title: `✅ ${cam.name} is online`, description: `${details || ""} via ${method} (${latency}ms)` });
      } else {
        toast({ title: `❌ ${cam.name} is offline`, description: error || "Not reachable", variant: "destructive" });
      }
    };

    try {
      const privateIp = isPrivateIp(cam.ip_address);
      if (privateIp) {
        const bp = await browserPing(cam.ip_address);
        if (bp.reachable) { setResult(true, bp.latency_ms, "browser", "HTTP"); return; }
      }
      if (agentUrl) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const resp = await fetch(`${agentUrl}/agent/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ip_address: cam.ip_address, port: cam.port }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (resp.ok) {
            const result = await resp.json();
            if (result.reachable) {
              const details = [result.http_reachable && "HTTP", result.rtsp_reachable && "RTSP"].filter(Boolean).join(" + ");
              setResult(true, result.latency_ms, "agent", details);
              return;
            }
            setResult(false, result.latency_ms, "agent", undefined, "Not reachable via local agent");
            return;
          }
        } catch { /* fall through */ }
      }
      // Private IPs can't be reached from cloud — skip edge function to avoid 30s timeout
      if (privateIp) {
        setResult(false, null, "browser", undefined,
          "Private IP — configure a Local Agent to test LAN cameras");
        return;
      }
      const result = await invokeEdgeFunction<{
        reachable: boolean; http_reachable: boolean; rtsp_reachable: boolean;
        latency_ms: number | null; error?: string;
      }>("camera-ping", { ip_address: cam.ip_address, port: cam.port });
      const details = [result.http_reachable && "HTTP", result.rtsp_reachable && "RTSP"].filter(Boolean).join(" + ");
      setResult(result.reachable, result.latency_ms, "cloud", details, result.error);
    } catch (err: any) {
      setPingStatus((s) => ({ ...s, [cam.id]: "offline" }));
      toast({ title: "Connection test failed", description: err.message, variant: "destructive" });
    }
  };

  const TestResultLine = ({ label, value }: { label: string; value: boolean | null }) => {
    if (value === null) return null;
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {value ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
        <span className={value ? "text-emerald-600" : "text-destructive"}>{label}</span>
      </div>
    );
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
        <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Registered Cameras
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => setShowAgentConfig(!showAgentConfig)}>
              <Signal className="w-3 h-3" /> Agent
            </Button>
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => setQrOpen(true)}>
              <ScanLine className="w-3 h-3" /> Scan QR
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Camera
            </Button>
          </div>
          {showAgentConfig && (
            <div className="w-full flex items-center gap-2 mt-1">
              <Label className="text-[10px] whitespace-nowrap text-muted-foreground">Local Agent URL:</Label>
              <Input
                className="h-7 text-xs font-mono max-w-xs"
                placeholder="http://192.168.1.50:8000"
                value={agentUrl}
                onChange={(e) => saveAgentUrl(e.target.value)}
              />
              {agentUrl && <Badge variant="outline" className="text-[9px]">configured</Badge>}
            </div>
          )}
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
                              {pingMethod[cam.id] && (
                                <span className="text-[8px] text-muted-foreground/70">{pingMethod[cam.id]}</span>
                              )}
                            </div>
                          );
                          if (ps === "offline") return <WifiOff className="w-3.5 h-3.5 text-destructive" />;
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
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => handleTestConnection(cam)}
                            disabled={pingStatus[cam.id] === "testing"}
                            title="Test connection"
                          >
                            {pingStatus[cam.id] === "testing"
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Signal className="w-3 h-3" />}
                          </Button>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Camera" : "Add Camera"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Name / Camera ID */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input placeholder="Front Door" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Camera ID *</Label>
                <Input placeholder="cam_front_door" value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} />
              </div>
            </div>
            {/* Brand / Model / UID */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Brand</Label>
                <Input placeholder="Reolink" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <Input placeholder="E1 Outdoor" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UID</Label>
                <Input placeholder="95270003..." value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} />
              </div>
            </div>
            {/* IP / Ports */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs">IP Address *</Label>
                <Input placeholder="10.0.0.139" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">RTSP Port</Label>
                <Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 554 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">HTTP Port</Label>
                <Input type="number" value={form.http_port} onChange={(e) => setForm({ ...form, http_port: parseInt(e.target.value) || 80 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">HTTPS Port</Label>
                <Input type="number" value={form.https_port} onChange={(e) => setForm({ ...form, https_port: parseInt(e.target.value) || 443 })} />
              </div>
            </div>
            {/* Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Password {editingId ? "(leave blank to keep)" : "*"}</Label>
                <Input type="password" placeholder={editingId ? "••••••••" : ""} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            {/* RTSP Paths */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">RTSP Path (AI detection)</Label>
                <Input value={form.rtsp_path} onChange={(e) => setForm({ ...form, rtsp_path: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">RTSP Path (High-res review)</Label>
                <Input value={form.rtsp_path_secondary} onChange={(e) => setForm({ ...form, rtsp_path_secondary: e.target.value })} />
              </div>
            </div>
            {/* Location / Zone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input placeholder="Front Door" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assigned Zone *</Label>
                <Select value={form.assigned_zone} onValueChange={(v) => setForm({ ...form, assigned_zone: v })}>
                  <SelectTrigger className={zoneMissing ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => (
                      <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {zoneMissing && <p className="text-[10px] text-destructive">Zone is required</p>}
              </div>
            </div>
            {/* Active */}
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">Active</Label>
            </div>

            {/* Test Connection */}
            <div className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Connection Test</Label>
                <Button
                  variant="outline" size="sm" className="h-7 text-[10px] gap-1"
                  onClick={handleDialogTestConnection}
                  disabled={dialogTesting || !form.ip_address.trim()}
                >
                  {dialogTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Signal className="w-3 h-3" />}
                  Test Connection
                </Button>
              </div>
              {dialogTestResult && (
                <div className="space-y-1.5 pt-1">
                  <TestResultLine label={`HTTP (port ${form.http_port})`} value={dialogTestResult.http} />
                  <TestResultLine label={`HTTPS (port ${form.https_port})`} value={dialogTestResult.https} />
                  <TestResultLine label={`RTSP (port ${form.port})`} value={dialogTestResult.rtsp} />
                  <TestResultLine label="Credentials valid" value={dialogTestResult.credentials} />
                  <TestResultLine label="RTSP path valid" value={dialogTestResult.rtsp_path} />
                  {dialogTestResult.latency_ms != null && (
                    <p className="text-[10px] text-muted-foreground">Latency: {dialogTestResult.latency_ms}ms</p>
                  )}
                  {dialogTestResult.error && (
                    <div className="flex items-start gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-600">{dialogTestResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || zoneMissing}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QRCameraScanner open={qrOpen} onOpenChange={setQrOpen} onScanned={handleQrScanned} />
    </>
  );
}
