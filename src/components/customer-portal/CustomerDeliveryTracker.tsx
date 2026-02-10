import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-yellow-500/20 text-yellow-500",
  "in-transit": "bg-blue-500/20 text-blue-500",
  delivered: "bg-green-500/20 text-green-500",
  completed: "bg-green-500/20 text-green-500",
};

interface DeliveryStop {
  id: string;
  stop_sequence: number;
  address: string | null;
  status: string | null;
  arrival_time: string | null;
}

interface Delivery {
  id: string;
  delivery_number: string;
  status: string | null;
  scheduled_date: string | null;
  vehicle: string | null;
  delivery_stops?: DeliveryStop[];
}

export function CustomerDeliveryTracker({ deliveries }: { deliveries: Delivery[] }) {
  if (deliveries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Truck className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No deliveries found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {deliveries.map((delivery) => {
        const status = (delivery.status || "pending").toLowerCase();
        const stops = delivery.delivery_stops || [];
        const completedStops = stops.filter(s => s.status === "completed").length;

        return (
          <Card key={delivery.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{delivery.delivery_number}</span>
                </div>
                <Badge className={statusColors[status] || statusColors.pending}>
                  {status}
                </Badge>
              </div>

              {delivery.scheduled_date && (
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {format(new Date(delivery.scheduled_date), "MMM d, yyyy")}
                </p>
              )}

              {/* Stop timeline */}
              {stops.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {completedStops}/{stops.length} stops completed
                  </p>
                  {stops.map((stop) => (
                    <div key={stop.id} className="flex items-start gap-2 text-xs">
                      {stop.status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <span className={stop.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}>
                        {stop.address || `Stop ${stop.stop_sequence}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
