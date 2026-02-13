import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Archive, Search, Package, MapPin, UserCheck, 
  ChevronRight, Pencil, Move, Trash2, FolderOpen 
} from "lucide-react";
import { format } from "date-fns";

export function PackingSlipsView() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["packing-slips-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id, delivery_number, status, scheduled_date, driver_name, vehicle, notes,
          delivery_stops (
            id, address, status, pod_signature, pod_photo_url, stop_sequence, notes,
            customers ( name )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        name: d.delivery_number,
        date: d.scheduled_date ? format(new Date(d.scheduled_date), "M/d/yyyy h:mm a") : null,
        status: d.status,
        driver: d.driver_name,
        vehicle: d.vehicle,
        stops: (d.delivery_stops || []).map((s: any) => ({
          address: s.address,
          customer: s.customers?.name || "Unknown",
          signoff: !!s.pod_signature || !!s.pod_photo_url,
          status: s.status,
        })),
        method: d.delivery_stops?.[0]?.address || "PICKUP",
        signoff: (d.delivery_stops || []).some((s: any) => s.pod_signature || s.pod_photo_url),
      }));
    },
  });

  const filteredDocs = deliveries.filter((d: any) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.stops.some((s: any) => s.customer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Archive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">Digital Archives</h1>
            <p className="text-[10px] tracking-[0.2em] text-primary/70 uppercase">Finalized Packing Slips & Evidence Repository</p>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search delivery or customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">All Deliveries</h2>
              </div>
              <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                {filteredDocs.length} Items Found
              </span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No deliveries found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredDocs.map((doc: any) => (
                  <Card key={doc.id} className="group hover:shadow-lg transition-all border-border hover:border-primary/30">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="w-11 h-11 rounded-xl bg-[hsl(220,25%,12%)] flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] tracking-widest text-muted-foreground/60 uppercase">Scheduled</p>
                          <p className="text-[11px] text-muted-foreground font-medium">{doc.date || "N/A"}</p>
                        </div>
                      </div>

                      <h3 className="text-base font-black uppercase text-foreground tracking-tight leading-tight">
                        {doc.name}
                      </h3>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <MapPin className="w-3 h-3 text-green-500" />
                          <span className="uppercase truncate">{doc.method}</span>
                        </div>
                        {doc.driver && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <UserCheck className="w-3 h-3 text-primary" />
                            <span className="uppercase">{doc.driver}</span>
                          </div>
                        )}
                        {doc.signoff && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <UserCheck className="w-3 h-3 text-primary" />
                            <span className="uppercase">POD Confirmed</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
                            <Move className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <button className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">
                          View Details <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
