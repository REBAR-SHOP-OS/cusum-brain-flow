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
import { Loader2, Plus } from "lucide-react";

const ZONES = [
  "loading_dock", "dispatch_yard", "cutter_area",
  "bender_area", "forklift_lane", "restricted_inventory",
  "front_door",
];

interface BulkCamera {
  ip: string;
  name: string;
  zone: string;
}

interface Props {
  companyId: string;
  existingCreds: { username: string; password: string } | null;
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

export default function BulkAddCameras({ companyId, existingCreds, onDone }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subnet, setSubnet] = useState("10.0.0");
  const [ipInput, setIpInput] = useState("");
  const [username, setUsername] = useState(existingCreds?.username || "admin");
  const [password, setPassword] = useState(existingCreds?.password || "");
  const [cameras, setCameras] = useState<BulkCamera[]>([]);
  const [saving, setSaving] = useState(false);

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

            {/* IP Input */}
            <div>
              <Label className="text-xs">IPs (last octet, full IP, or range like 140-145)</Label>
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
