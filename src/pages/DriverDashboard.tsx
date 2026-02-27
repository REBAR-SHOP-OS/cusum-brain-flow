import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isValidDeliveryTransition } from "@/lib/deliveryTransitions";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { PODCaptureDialog } from "@/components/delivery/PODCaptureDialog";
import { StopIssueDialog } from "@/components/delivery/StopIssueDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Camera,
  FileWarning,
  Navigation,
  User,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Delivery {
  id: string;
  delivery_number: string;
  driver_name: string | null;
  driver_profile_id: string | null;
  vehicle: string | null;
  scheduled_date: string | null;
  status: string | null;
  notes: string | null;
}

interface DeliveryStop {
  id: string;
  delivery_id: string;
  stop_sequence: number;
  address: string | null;
  status: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  pod_signature: string | null;
  pod_photo_url: string | null;
  exception_reason: string | null;
  notes: string | null;
  customer_id: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-accent/20 text-accent-foreground",
  planned: "bg-accent/20 text-accent-foreground",
  "in-transit": "bg-primary/20 text-primary",
  delivered: "bg-primary/30 text-primary",
  completed: "bg-primary/30 text-primary",
  completed_with_issues: "bg-destructive/20 text-destructive",
};

const stopStatusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  arrived: "bg-primary/20 text-primary",
  completed: "bg-primary/30 text-primary",
  skipped: "bg-destructive/20 text-destructive",
  failed: "bg-destructive/20 text-destructive",
};

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [podStopId, setPodStopId] = useState<string | null>(null);
  const [issueStopId, setIssueStopId] = useState<string | null>(null);
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  // Get current user's profile name to filter deliveries
  const { data: myProfile } = useQuery({
    queryKey: ["driver-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const today = new Date().toISOString().split("T")[0];

  // Fetch deliveries assigned to this driver
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["driver-deliveries", companyId, myProfile?.id],
    enabled: !!companyId && !!myProfile?.id,
    queryFn: async () => {
      // Try driver_profile_id first (new column), fall back to driver_name
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("company_id", companyId!)
        .or(`driver_profile_id.eq.${myProfile!.id},driver_name.eq.${myProfile!.full_name},driver_name.is.null`)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as Delivery[];
    },
  });

  // Fetch stops for selected delivery
  const { data: stops = [] } = useQuery({
    queryKey: ["driver-stops", selectedDelivery?.id, companyId],
    enabled: !!selectedDelivery && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_stops")
        .select("*")
        .eq("delivery_id", selectedDelivery!.id)
        .eq("company_id", companyId!)
        .order("stop_sequence", { ascending: true });
      if (error) throw error;
      return data as DeliveryStop[];
    },
  });

  const todayDeliveries = deliveries.filter(d => d.scheduled_date?.startsWith(today));
  const activeDelivery = deliveries.find(d => d.status === "in-transit");
  const completedToday = todayDeliveries.filter(d => d.status === "completed" || d.status === "delivered" || d.status === "completed_with_issues");
  const pendingToday = todayDeliveries.filter(d => d.status !== "completed" && d.status !== "delivered" && d.status !== "completed_with_issues");

  const refreshStops = () => {
    queryClient.invalidateQueries({ queryKey: ["driver-stops", selectedDelivery?.id, companyId] });
    queryClient.invalidateQueries({ queryKey: ["driver-deliveries", companyId, myProfile?.id] });
  };

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`driver-live-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () =>
        queryClient.invalidateQueries({ queryKey: ["driver-deliveries", companyId, myProfile?.id] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_stops" }, () => {
        queryClient.invalidateQueries({ queryKey: ["driver-deliveries", companyId, myProfile?.id] });
        if (selectedDelivery) {
          queryClient.invalidateQueries({ queryKey: ["driver-stops", selectedDelivery.id, companyId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, selectedDelivery?.id, myProfile?.id, queryClient]);

  const handleStartDelivery = async (deliveryId: string) => {
    const currentStatus = selectedDelivery?.status || "pending";
    if (!isValidDeliveryTransition(currentStatus, "in-transit")) {
      toast.error(`Cannot transition from "${currentStatus}" to "in-transit"`);
      return;
    }
    await supabase
      .from("deliveries")
      .update({ status: "in-transit" })
      .eq("id", deliveryId);
    // Bug #3 fix: Optimistic update to prevent double-tap
    setSelectedDelivery(prev => prev ? { ...prev, status: "in-transit" } : null);
    refreshStops();
  };

  const handleMarkArrived = async (stopId: string) => {
    await supabase
      .from("delivery_stops")
      .update({ status: "arrived", arrival_time: new Date().toISOString() })
      .eq("id", stopId);
    refreshStops();
  };

  // Detail view for a selected delivery
  if (selectedDelivery) {
    const completedStops = stops.filter(s => s.status === "completed").length;
    const totalStops = stops.length;

    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDelivery(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{selectedDelivery.delivery_number}</h1>
            <p className="text-xs text-muted-foreground">
              {completedStops}/{totalStops} stops completed
            </p>
          </div>
          <Badge className={statusColors[selectedDelivery.status || "pending"]}>
            {selectedDelivery.status || "pending"}
          </Badge>
        </header>

        {/* Info bar */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-4 text-sm text-muted-foreground">
          {selectedDelivery.vehicle && (
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" /> {selectedDelivery.vehicle}
            </span>
          )}
          {selectedDelivery.scheduled_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {format(new Date(selectedDelivery.scheduled_date), "MMM d")}
            </span>
          )}
        </div>

        {/* Claim / Start Delivery */}
        {(selectedDelivery.status === "pending" || selectedDelivery.status === "scheduled") && (
          <div className="px-4 py-3 border-b border-border space-y-2">
            {!selectedDelivery.driver_name && !selectedDelivery.driver_profile_id && (
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={async () => {
                  await supabase
                    .from("deliveries")
                    .update({ driver_name: myProfile!.full_name, driver_profile_id: myProfile!.id })
                    .eq("id", selectedDelivery.id);
                  setSelectedDelivery(prev => prev ? { ...prev, driver_name: myProfile!.full_name, driver_profile_id: myProfile!.id } : null);
                  refreshStops();
                  toast.success("Delivery claimed");
                }}
              >
                <User className="w-4 h-4" />
                Claim This Delivery
              </Button>
            )}
            {(selectedDelivery.driver_name || selectedDelivery.driver_profile_id) && (
              <Button
                className="w-full gap-2"
                onClick={() => handleStartDelivery(selectedDelivery.id)}
              >
                <Truck className="w-4 h-4" />
                Start Delivery
              </Button>
            )}
          </div>
        )}

        {/* Stops list */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {stops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MapPin className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No stops on this delivery</p>
              </div>
            ) : stops.map((stop, i) => {
              const status = (stop.status || "pending").toLowerCase();
              const isCompleted = status === "completed";
              const isFailed = status === "failed";
              const isActionable = !isCompleted && !isFailed;

              return (
                <Card key={stop.id} className={isCompleted ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCompleted ? "bg-primary/20 text-primary" : isFailed ? "bg-destructive/20 text-destructive" : "bg-primary text-primary-foreground"
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{stop.address || "No address"}</span>
                          <Badge className={stopStatusColors[status]} variant="outline">
                            {status}
                          </Badge>
                        </div>

                        {/* Timestamps */}
                        <div className="text-xs text-muted-foreground space-y-0.5 mb-2">
                          {stop.arrival_time && <div>Arrived: {format(new Date(stop.arrival_time), "h:mm a")}</div>}
                          {stop.departure_time && <div>Departed: {format(new Date(stop.departure_time), "h:mm a")}</div>}
                          {stop.pod_signature && <div className="text-primary">✓ Signature captured</div>}
                          {stop.pod_photo_url && <div className="text-primary">✓ Photo captured</div>}
                          {stop.exception_reason && <div className="text-destructive">⚠ {stop.exception_reason}</div>}
                        </div>

                        {/* Action buttons */}
                        {isActionable && (
                          <div className="flex flex-wrap gap-2">
                            {status === "pending" && (
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleMarkArrived(stop.id)}>
                                <Navigation className="w-3.5 h-3.5" />
                                Mark Arrived
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => navigate(`/driver/dropoff/${stop.id}`)}>
                              <Camera className="w-3.5 h-3.5" />
                              Capture POD
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-destructive" onClick={() => setIssueStopId(stop.id)}>
                              <FileWarning className="w-3.5 h-3.5" />
                              Issue
                            </Button>
                            {stop.address && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs gap-1.5"
                                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(stop.address!)}`, "_blank")}
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                Navigate
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <PODCaptureDialog
          open={!!podStopId}
          onOpenChange={(open) => !open && setPodStopId(null)}
          stopId={podStopId || ""}
          onComplete={refreshStops}
        />
        <StopIssueDialog
          open={!!issueStopId}
          onOpenChange={(open) => !open && setIssueStopId(null)}
          stopId={issueStopId || ""}
          onComplete={refreshStops}
        />
      </div>
    );
  }

  // Main driver dashboard
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Driver Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {myProfile?.full_name || "Loading..."}
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-background border border-border">
            <p className="text-2xl font-bold text-primary">{pendingToday.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background border border-border">
            <p className="text-2xl font-bold">{activeDelivery ? 1 : 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">In Transit</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background border border-border">
            <p className="text-2xl font-bold text-primary/70">{completedToday.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Done</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Active delivery highlight */}
      {activeDelivery && (
        <div className="px-4 pt-4">
          <button
            className="w-full text-left"
            onClick={() => setSelectedDelivery(activeDelivery)}
          >
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-semibold">Active Delivery</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{activeDelivery.delivery_number}</p>
                <p className="text-xs text-muted-foreground">{activeDelivery.vehicle || "No vehicle assigned"}</p>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {/* Today's deliveries */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {!isLoading && todayDeliveries.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Today's Deliveries ({todayDeliveries.length})
              </h2>
              <div className="space-y-2">
                {todayDeliveries.map(d => (
                  <button
                    key={d.id}
                    className="w-full text-left"
                    onClick={() => setSelectedDelivery(d)}
                  >
                    <Card className="hover:bg-muted/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{d.delivery_number}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {d.vehicle && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{d.vehicle}</span>}
                            {d.scheduled_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(d.scheduled_date), "h:mm a")}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[d.status || "pending"]}>{d.status || "pending"}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming deliveries */}
          {!isLoading && deliveries.filter(d => d.scheduled_date && d.scheduled_date > today).length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Upcoming
              </h2>
              <div className="space-y-2">
                {deliveries.filter(d => d.scheduled_date && d.scheduled_date > today).map(d => (
                  <button
                    key={d.id}
                    className="w-full text-left"
                    onClick={() => setSelectedDelivery(d)}
                  >
                    <Card className="hover:bg-muted/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{d.delivery_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.scheduled_date && format(new Date(d.scheduled_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && deliveries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">No deliveries available</p>
              <p className="text-xs mt-1">Assigned and unassigned deliveries will appear here</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

DriverDashboard.displayName = "DriverDashboard";
