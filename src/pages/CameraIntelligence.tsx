import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Camera, Truck, AlertTriangle, Activity,
  Shield, MapPin, Clock, Loader2, Settings,
} from "lucide-react";
import CameraManager from "@/components/camera/CameraManager";

interface CameraEvent {
  id: string;
  event_type: string;
  camera_id: string | null;
  zone: string | null;
  detected_class: string | null;
  confidence: number | null;
  related_machine_id: string | null;
  related_order_id: string | null;
  related_delivery_id: string | null;
  snapshot_url: string | null;
  recommended_action: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  truck_arrived: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  dispatch_ready_event: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  loading_started: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  unauthorized_zone_entry: "bg-destructive/20 text-destructive border-destructive/30",
  after_hours_motion: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  machine_operator_present: "bg-primary/20 text-primary border-primary/30",
  utilization_anomaly: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  dispatch_activity_detected: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

const ZONE_ICONS: Record<string, React.ReactNode> = {
  loading_dock: <Truck className="w-4 h-4" />,
  dispatch_yard: <Truck className="w-4 h-4" />,
  cutter_area: <Activity className="w-4 h-4" />,
  bender_area: <Activity className="w-4 h-4" />,
  restricted_inventory: <Shield className="w-4 h-4" />,
  forklift_lane: <MapPin className="w-4 h-4" />,
};

const ZONES = [
  "loading_dock", "dispatch_yard", "cutter_area",
  "bender_area", "forklift_lane", "restricted_inventory",
];

export default function CameraIntelligence() {
  const { companyId } = useCompanyId();
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("camera_events")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);
      setEvents((data as CameraEvent[]) ?? []);
      setLoading(false);
    })();
  }, [companyId]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("camera-events-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "camera_events",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setEvents((prev) => [payload.new as CameraEvent, ...prev].slice(0, 200));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  const dispatchEvents = events.filter(
    (e) => e.event_type === "dispatch_ready_event" || e.event_type === "truck_arrived" || e.event_type === "loading_started",
  );
  const anomalyEvents = events.filter((e) => e.event_type === "utilization_anomaly");
  const alertEvents = events.filter(
    (e) => e.event_type === "unauthorized_zone_entry" || e.event_type === "after_hours_motion",
  );

  const zoneLastActivity = ZONES.reduce<Record<string, CameraEvent | null>>((acc, z) => {
    acc[z] = events.find((e) => e.zone === z) ?? null;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
          <Camera className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Camera Intelligence
          </h1>
          <p className="text-xs text-muted-foreground tracking-wide uppercase">
            Production Visibility · Dispatch · Incident Tracking
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total Events" value={events.length} icon={<Camera className="w-4 h-4" />} />
        <MiniStat label="Dispatch" value={dispatchEvents.length} icon={<Truck className="w-4 h-4" />} />
        <MiniStat label="Anomalies" value={anomalyEvents.length} icon={<Activity className="w-4 h-4" />} />
        <MiniStat label="Alerts" value={alertEvents.length} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dispatch Readiness */}
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              Dispatch Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {dispatchEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dispatch events yet</p>
            ) : (
              dispatchEvents.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`text-[10px] shrink-0 ${EVENT_COLORS[e.event_type] ?? ""}`}>
                      {e.event_type.replace(/_/g, " ")}
                    </Badge>
                    {e.zone && <span className="text-[10px] text-muted-foreground truncate">{e.zone}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(e.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Machine Anomalies */}
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              Machine Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {anomalyEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No anomalies detected</p>
            ) : (
              anomalyEvents.slice(0, 10).map((e) => (
                <div key={e.id} className="py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center justify-between">
                    <Badge className={EVENT_COLORS.utilization_anomaly}>anomaly</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {e.recommended_action && (
                    <p className="text-[10px] text-muted-foreground mt-1">{e.recommended_action}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Zone Status */}
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Zone Status
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {ZONES.map((z) => {
              const last = zoneLastActivity[z];
              const hasAlert = last && (last.event_type === "unauthorized_zone_entry" || last.event_type === "after_hours_motion");
              return (
                <div
                  key={z}
                  className={`rounded-lg border p-2.5 ${
                    hasAlert
                      ? "border-destructive/40 bg-destructive/5"
                      : last
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/40 bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {ZONE_ICONS[z] ?? <MapPin className="w-3 h-3" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">
                      {z.replace(/_/g, " ")}
                    </span>
                  </div>
                  {last ? (
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(last.created_at).toLocaleTimeString()}
                    </p>
                  ) : (
                    <p className="text-[9px] text-muted-foreground">No activity</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Live Event Feed */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Live Event Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Time</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Zone</TableHead>
                  <TableHead className="text-[10px]">Class</TableHead>
                  <TableHead className="text-[10px]">Conf.</TableHead>
                  <TableHead className="text-[10px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                      No camera events yet. Connect your FastAPI service to start receiving detections.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.slice(0, 50).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] ${EVENT_COLORS[e.event_type] ?? "bg-muted text-muted-foreground"}`}>
                          {e.event_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px]">{e.zone ?? "—"}</TableCell>
                      <TableCell className="text-[10px]">{e.detected_class ?? "—"}</TableCell>
                      <TableCell className="text-[10px]">
                        {e.confidence != null ? `${(e.confidence * 100).toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {e.recommended_action ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="text-primary/70">{icon}</div>
        <div>
          <p className="text-lg font-bold text-foreground">{value}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
