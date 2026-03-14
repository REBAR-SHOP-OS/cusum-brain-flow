import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Radar } from "lucide-react";

const ZONES = [
  "loading_dock", "dispatch_yard", "cutter_area",
  "bender_area", "forklift_lane", "restricted_inventory",
  "front_door",
];

interface BulkCamera {
  ip: string;
  name: string;
  zone: string;
  model?: string;
  serial?: string;
}

interface Props {
  companyId: string;
  existingCreds: { username: string; password: string } | null;
  agentUrl?: string;
  onAgentUrlChange?: (url: string) => void;
  onDone: () => void;
}

/** Parse IPs from user input: supports full IPs, last-octets, and ranges like 140-145 */
function parseIps(raw: string, subnet: string): string[] {
  const ips: string[] = [];
  const parts = raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      for (let i = start; i <= end && i <= 255; i++) {
        ips.push(`${subnet}.${i}`);
      }
    } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part)) {
      ips.push(part);
    } else if (/^\d{1,3}$/.test(part)) {
      ips.push(`${subnet}.${part}`);
    }
  }
  return [...new Set(ips)];
}

export default function BulkAddCameras({ companyId, existingCreds, agentUrl, onAgentUrlChange, onDone }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subnet, setSubnet] = useState("10.0.0");
  const [rangeStart, setRangeStart] = useState("100");
  const [rangeEnd, setRangeEnd] = useState("200");
  const [ipInput, setIpInput] = useState("");
  const [username, setUsername] = useState(existingCreds?.username || "admin");
  const [password, setPassword] = useState(existingCreds?.password || "");
  const [cameras, setCameras] = useState<BulkCamera[]>([]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [localAgentUrl, setLocalAgentUrl] = useState(agentUrl || "");

  const handleParse = () => {
    const ips = parseIps(ipInput, subnet);
    if (ips.length === 0) {
      toast({ title: "No IPs found", description: "Enter IPs, last octets, or a range like 140-145", variant: "destructive" });
      return;
    }
    setCameras(ips.map((ip) => ({
      ip,
      name: `Camera-${ip.split(".").pop()}`,
      zone: "",
    })));
  };

  const handleScanSubnet = async () => {
    if (!agentUrl) {
      toast({ title: "Local Agent not configured", description: "Set the Local Agent URL in camera settings to use subnet scanning.", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Password required", description: "Enter the camera password before scanning.", variant: "destructive" });
      return;
    }
    setScanning(true);
    setScanProgress(10);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      setScanProgress(20);
      const resp = await fetch(`${agentUrl}/agent/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subnet,
          start: parseInt(rangeStart) || 1,
          end: parseInt(rangeEnd) || 254,
          username,
          password,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      setScanProgress(90);
      if (!resp.ok) throw new Error(`Agent returned ${resp.status}`);
      const data = await resp.json();
      setScanProgress(100);
      if (data.cameras && data.cameras.length > 0) {
        setCameras(data.cameras.map((c: any) => ({
          ip: c.ip,
          name: c.name || `Camera-${c.ip.split(".").pop()}`,
          zone: "",
          model: c.model,
          serial: c.serial,
        })));
        toast({ title: `Found ${data.cameras.length} camera(s)`, description: `Scanned ${data.scanned} IPs` });
      } else {
        toast({ title: "No cameras found", description: `Scanned ${data.scanned || 0} IPs with no Reolink responses.`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message || "Could not reach Local Agent", variant: "destructive" });
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const updateCamera = (idx: number, field: keyof BulkCamera, val: string) => {
    setCameras((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const handleBulkInsert = async () => {
    const missing = cameras.filter((c) => !c.zone);
    if (missing.length > 0) {
      toast({ title: "Zones required", description: `${missing.length} camera(s) need a zone assigned.`, variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Password required", variant: "destructive" });
      return;
    }
    setSaving(true);

    const rows = cameras.map((c) => ({
      company_id: companyId,
      camera_id: `reolink-${c.ip.replace(/\./g, "-")}`,
      name: c.name,
      ip_address: c.ip,
      port: 554,
      http_port: 80,
      https_port: 443,
      username,
      password,
      rtsp_path: "/h264Preview_01_sub",
      rtsp_path_secondary: "/h264Preview_01_main",
      assigned_zone: c.zone,
      is_active: true,
      brand: "Reolink",
      model: c.model || null,
    }));

    const { error } = await supabase.from("cameras").insert(rows as any);
    setSaving(false);

    if (error) {
      toast({ title: "Bulk insert failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${rows.length} camera(s) added` });
      setOpen(false);
      setCameras([]);
      setIpInput("");
      onDone();
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3" /> Bulk Add
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Add Reolink Cameras</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Credentials */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Subnet</Label>
                <Input className="h-8 text-xs font-mono" value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="10.0.0" />
              </div>
              <div>
                <Label className="text-xs">Username</Label>
                <Input className="h-8 text-xs" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <Input className="h-8 text-xs" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            {/* Auto-Discover */}
            {agentUrl && (
              <div className="border border-dashed rounded-md p-3 space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Radar className="w-3.5 h-3.5" /> Auto-Discover (Subnet Scan)
                </Label>
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Start</Label>
                    <Input className="h-7 text-xs font-mono w-20" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">End</Label>
                    <Input className="h-7 text-xs font-mono w-20" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                  </div>
                  <Button size="sm" variant="secondary" className="gap-1.5 h-7 text-xs" onClick={handleScanSubnet} disabled={scanning}>
                    {scanning ? <><Loader2 className="w-3 h-3 animate-spin" /> Scanning...</> : <><Radar className="w-3 h-3" /> Scan Subnet</>}
                  </Button>
                </div>
                {scanning && <Progress value={scanProgress} className="h-1.5" />}
                <p className="text-[10px] text-muted-foreground">
                  Scans {subnet}.{rangeStart}–{rangeEnd} via Local Agent, auto-discovers Reolink cameras using their HTTP API.
                </p>
              </div>
            )}

            {/* Manual IP Input */}
            <div>
              <Label className="text-xs">Manual IPs (last octet, full IP, or range like 140-145)</Label>
              <div className="flex gap-2">
                <Textarea
                  className="text-xs font-mono min-h-[60px]"
                  placeholder={"139\n140-145\n10.0.0.200"}
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                />
                <Button size="sm" className="shrink-0 self-end" onClick={handleParse}>
                  Parse
                </Button>
              </div>
            </div>

            {/* Camera table */}
            {cameras.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">IP</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Model</TableHead>
                      <TableHead className="text-xs">Zone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cameras.map((cam, idx) => (
                      <TableRow key={cam.ip}>
                        <TableCell className="text-xs font-mono py-1">{cam.ip}</TableCell>
                        <TableCell className="py-1">
                          <Input
                            className="h-7 text-xs"
                            value={cam.name}
                            onChange={(e) => updateCamera(idx, "name", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-xs py-1 text-muted-foreground">{cam.model || "—"}</TableCell>
                        <TableCell className="py-1">
                          <Select value={cam.zone} onValueChange={(v) => updateCamera(idx, "zone", v)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Select zone" />
                            </SelectTrigger>
                            <SelectContent>
                              {ZONES.map((z) => (
                                <SelectItem key={z} value={z} className="text-xs">{z.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkInsert} disabled={cameras.length === 0 || saving}>
              {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...</> : `Add ${cameras.length} Camera(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
