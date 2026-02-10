import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompletedBundles } from "@/hooks/useCompletedBundles";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { ReadyBundleList } from "@/components/dispatch/ReadyBundleList";
import { PODCaptureDialog } from "@/components/delivery/PODCaptureDialog";
import { StopIssueDialog } from "@/components/delivery/StopIssueDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Plus,
  Calendar,
  User,
  ArrowLeft,
  Camera,
  FileWarning
} from "lucide-react";
import { format } from "date-fns";

interface Delivery {
  id: string;
  delivery_number: string;
  driver_name: string | null;
  vehicle: string | null;
  scheduled_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  stops?: DeliveryStop[];
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
  scheduled: "bg-yellow-500/20 text-yellow-500",
  "in-transit": "bg-blue-500/20 text-blue-500",
  delivered: "bg-green-500/20 text-green-500",
  completed: "bg-green-500/20 text-green-500",
  partial: "bg-orange-500/20 text-orange-500",
  failed: "bg-destructive/20 text-destructive",
};

const stopStatusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  arrived: "bg-blue-500/20 text-blue-500",
  completed: "bg-green-500/20 text-green-500",
  skipped: "bg-orange-500/20 text-orange-500",
  failed: "bg-destructive/20 text-destructive",
};

export default function Deliveries() {
  const [activeTab, setActiveTab] = useState("today");
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [driverMode, setDriverMode] = useState(false);
  const [podStopId, setPodStopId] = useState<string | null>(null);
  const [issueStopId, setIssueStopId] = useState<string | null>(null);
  const { bundles } = useCompletedBundles();
  const { user } = useAuth();
  const { isField } = useUserRole();
  const queryClient = useQueryClient();

  // Get current user's profile name for driver mode filtering
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-driver", user?.id],
    enabled: !!user && driverMode,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: deliveries = [], isLoading, error } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data as Delivery[];
    },
  });

  const { data: stops = [] } = useQuery({
    queryKey: ["delivery-stops", selectedDelivery?.id],
    queryFn: async () => {
      if (!selectedDelivery) return [];
      const { data, error } = await supabase
        .from("delivery_stops")
        .select("*")
        .eq("delivery_id", selectedDelivery.id)
        .order("stop_sequence", { ascending: true });
      
      if (error) throw error;
      return data as DeliveryStop[];
    },
    enabled: !!selectedDelivery,
  });

  // Apply driver mode filter
  const filteredDeliveries = driverMode && myProfile?.full_name
    ? deliveries.filter(d => d.driver_name === myProfile.full_name)
    : deliveries;

  const today = new Date().toISOString().split("T")[0];
  
  const todayDeliveries = filteredDeliveries.filter(d => 
    d.scheduled_date?.startsWith(today)
  );
  
  const upcomingDeliveries = filteredDeliveries.filter(d => 
    d.scheduled_date && d.scheduled_date > today
  );
  
  const completedDeliveries = filteredDeliveries.filter(d => 
    d.status === "completed" || d.status === "delivered"
  );

  const activeDeliveries = filteredDeliveries.filter(d => 
    d.status === "in-transit"
  );

  const refreshStops = () => {
    queryClient.invalidateQueries({ queryKey: ["delivery-stops", selectedDelivery?.id] });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Failed to load deliveries</h2>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Delivery List */}
      <div className={`${selectedDelivery ? 'hidden md:flex' : 'flex'} flex-1 flex-col border-r border-border`}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Deliveries
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeDeliveries.length} in transit • {todayDeliveries.length} today
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Driver Mode Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Driver Mode</label>
              <Switch checked={driverMode} onCheckedChange={setDriverMode} />
            </div>
            {!driverMode && (
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Delivery</span>
              </Button>
            )}
          </div>
        </header>

        {/* Stats Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              label="In Transit" 
              value={activeDeliveries.length} 
              icon={<Truck className="w-4 h-4 text-primary" />}
            />
            <StatCard 
              label="Today" 
              value={todayDeliveries.length} 
              icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
            />
            <StatCard 
              label="Upcoming" 
              value={upcomingDeliveries.length} 
              icon={<Clock className="w-4 h-4 text-primary" />}
            />
            <StatCard 
              label="Completed" 
              value={completedDeliveries.length} 
              icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
            />
          </div>
        </div>

        {/* Ready Bundles from Clearance */}
        {bundles.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <ReadyBundleList
              bundles={bundles}
              title="Cleared — Ready for Delivery"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-4 sm:px-6 pt-4">
              <TabsList>
                <TabsTrigger value="today">Today ({todayDeliveries.length})</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming ({upcomingDeliveries.length})</TabsTrigger>
                <TabsTrigger value="all">All ({filteredDeliveries.length})</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="today" className="flex-1 overflow-hidden px-4 sm:px-6 pb-6">
              <DeliveryList 
                deliveries={todayDeliveries} 
                isLoading={isLoading}
                selectedId={selectedDelivery?.id}
                onSelect={setSelectedDelivery}
                emptyMessage="No deliveries scheduled for today"
              />
            </TabsContent>

            <TabsContent value="upcoming" className="flex-1 overflow-hidden px-4 sm:px-6 pb-6">
              <DeliveryList 
                deliveries={upcomingDeliveries} 
                isLoading={isLoading}
                selectedId={selectedDelivery?.id}
                onSelect={setSelectedDelivery}
                emptyMessage="No upcoming deliveries"
              />
            </TabsContent>

            <TabsContent value="all" className="flex-1 overflow-hidden px-4 sm:px-6 pb-6">
              <DeliveryList 
                deliveries={filteredDeliveries} 
                isLoading={isLoading}
                selectedId={selectedDelivery?.id}
                onSelect={setSelectedDelivery}
                emptyMessage="No deliveries found"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Detail Panel */}
      <div className={`${selectedDelivery ? 'flex' : 'hidden md:flex'} w-full md:w-96 flex-col bg-muted/20`}>
        {selectedDelivery ? (
          <>
            <header className="px-4 sm:px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedDelivery(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-semibold flex-1">{selectedDelivery.delivery_number}</h2>
                <Badge className={statusColors[selectedDelivery.status || "pending"]}>
                  {selectedDelivery.status || "pending"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                {selectedDelivery.driver_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedDelivery.driver_name}
                  </div>
                )}
                {selectedDelivery.vehicle && (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    {selectedDelivery.vehicle}
                  </div>
                )}
                {selectedDelivery.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(selectedDelivery.scheduled_date), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-hidden">
              <div className="px-4 sm:px-6 py-4">
                <h3 className="text-sm font-medium mb-3">Stops ({stops.length})</h3>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-3 pr-4">
                    {stops.map((stop, index) => (
                      <StopCard 
                        key={stop.id} 
                        stop={stop} 
                        index={index}
                        driverMode={driverMode}
                        onPOD={() => setPodStopId(stop.id)}
                        onIssue={() => setIssueStopId(stop.id)}
                      />
                    ))}
                    {stops.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No stops added yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-border">
              <Button className="w-full gap-2">
                <MapPin className="w-4 h-4" />
                View Route
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Select a delivery to view details</p>
          </div>
        )}
      </div>

      {/* POD & Issue Dialogs */}
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

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
      <div className="p-2 rounded-md bg-muted">{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface DeliveryListProps {
  deliveries: Delivery[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (delivery: Delivery) => void;
  emptyMessage: string;
}

function DeliveryList({ deliveries, isLoading, selectedId, onSelect, emptyMessage }: DeliveryListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-3 pr-4 pt-4">
        {deliveries.map((delivery) => (
          <DeliveryCard 
            key={delivery.id} 
            delivery={delivery} 
            isSelected={delivery.id === selectedId}
            onClick={() => onSelect(delivery)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface DeliveryCardProps {
  delivery: Delivery;
  isSelected: boolean;
  onClick: () => void;
}

function DeliveryCard({ delivery, isSelected, onClick }: DeliveryCardProps) {
  const status = (delivery.status || "pending").toLowerCase();
  
  return (
    <Card 
      className={`cursor-pointer transition-colors ${
        isSelected ? "ring-2 ring-primary" : "hover:bg-muted/30"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">{delivery.delivery_number}</span>
          <Badge className={statusColors[status]}>
            {status}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          {delivery.driver_name && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              {delivery.driver_name}
            </div>
          )}
          {delivery.scheduled_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              {format(new Date(delivery.scheduled_date), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StopCard({ stop, index, driverMode, onPOD, onIssue }: { 
  stop: DeliveryStop; 
  index: number;
  driverMode?: boolean;
  onPOD?: () => void;
  onIssue?: () => void;
}) {
  const status = (stop.status || "pending").toLowerCase();
  const isActionable = driverMode && status !== "completed" && status !== "failed";
  
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">
                {stop.address || "No address"}
              </span>
              <Badge className={stopStatusColors[status]} variant="outline">
                {status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {stop.arrival_time && (
                <div>Arrived: {format(new Date(stop.arrival_time), "h:mm a")}</div>
              )}
              {stop.departure_time && (
                <div>Departed: {format(new Date(stop.departure_time), "h:mm a")}</div>
              )}
              {stop.pod_signature && (
                <div className="text-primary">✓ Signed</div>
              )}
              {stop.exception_reason && (
                <div className="text-destructive">{stop.exception_reason}</div>
              )}
            </div>
            {/* Driver mode action buttons */}
            {isActionable && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onPOD}>
                  <Camera className="w-3 h-3" />
                  POD
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={onIssue}>
                  <FileWarning className="w-3 h-3" />
                  Issue
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
