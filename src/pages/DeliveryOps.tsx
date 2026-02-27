import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { ArrowLeft, Truck, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryCard {
  id: string;
  delivery_number: string;
  status: string;
  scheduled_date: string | null;
  customer_name: string | null;
  stop_id: string | null;
  item_count: number;
  bundle_summary: string;
  site_address: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "PENDING",
  scheduled: "SCHEDULED",
  staged: "STAGED AT SHOP",
  "in-transit": "IN TRANSIT",
  delivered: "DELIVERED",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/20 text-primary",
  staged: "bg-amber-500/20 text-amber-400",
  "in-transit": "bg-blue-500/20 text-blue-400",
  delivered: "bg-emerald-500/20 text-emerald-400",
};

export default function DeliveryOps() {
  const { companyId } = useCompanyId();
  const [cards, setCards] = useState<DeliveryCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      // Fetch deliveries with their first stop and packing slip info
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, status, scheduled_date")
        .eq("company_id", companyId)
        .in("status", ["pending", "scheduled", "staged", "in-transit", "delivered"])
        .order("created_at", { ascending: false });

      if (!deliveries?.length) {
        setCards([]);
        setLoading(false);
        return;
      }

      const deliveryIds = deliveries.map((d) => d.id);

      const [{ data: stops }, { data: slips }] = await Promise.all([
        supabase
          .from("delivery_stops")
          .select("id, delivery_id, address, stop_sequence")
          .in("delivery_id", deliveryIds)
          .order("stop_sequence", { ascending: true }),
        supabase
          .from("packing_slips")
          .select("delivery_id, customer_name, items_json, site_address")
          .in("delivery_id", deliveryIds),
      ]);

      const stopMap = new Map<string, { id: string; address: string | null }>();
      stops?.forEach((s) => {
        if (!stopMap.has(s.delivery_id)) {
          stopMap.set(s.delivery_id, { id: s.id, address: s.address });
        }
      });

      const slipMap = new Map<string, { customer_name: string | null; item_count: number; site_address: string | null }>();
      slips?.forEach((s) => {
        const items = Array.isArray(s.items_json) ? s.items_json : [];
        const existing = slipMap.get(s.delivery_id!);
        slipMap.set(s.delivery_id!, {
          customer_name: existing?.customer_name || s.customer_name,
          item_count: (existing?.item_count || 0) + items.length,
          site_address: existing?.site_address || s.site_address,
        });
      });

      const result: DeliveryCard[] = deliveries.map((d) => {
        const stop = stopMap.get(d.id);
        const slip = slipMap.get(d.id);
        const itemCount = slip?.item_count || 0;
        return {
          id: d.id,
          delivery_number: d.delivery_number,
          status: d.status || "pending",
          scheduled_date: d.scheduled_date,
          customer_name: slip?.customer_name || d.delivery_number,
          stop_id: stop?.id || null,
          item_count: itemCount,
          bundle_summary: `${itemCount} item${itemCount !== 1 ? "s" : ""} for site drop`,
          site_address: slip?.site_address || stop?.address,
        };
      });

      setCards(result);
      setLoading(false);
    })();
  }, [companyId]);

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-destructive/10 blur-[160px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-4 py-5">
        <Link to="/shop-floor" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black tracking-wider text-foreground uppercase">Delivery Ops</h1>
          <p className="text-[10px] tracking-[0.3em] text-primary/70 uppercase">Active Dispatches</p>
        </div>
      </header>

      {/* Cards */}
      <div className="relative z-10 flex-1 px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Truck className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground tracking-wider uppercase">No active deliveries</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => {
              const inner = (
                <div className="group relative flex flex-col gap-3 p-5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/40 transition-all duration-200 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)] cursor-pointer">
                  {/* Status badge */}
                  <span className={cn("self-start px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase", STATUS_COLORS[card.status] || STATUS_COLORS.pending)}>
                    {STATUS_LABELS[card.status] || card.status.toUpperCase()}
                  </span>

                  {/* Customer / project name */}
                  <h3 className="text-lg font-black tracking-wide text-foreground uppercase leading-tight">
                    {card.customer_name}
                  </h3>

                  {/* Bundle summary */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="w-3.5 h-3.5" />
                    <span className="text-xs tracking-wider uppercase">{card.bundle_summary}</span>
                  </div>

                  {/* Site address */}
                  {card.site_address && (
                    <p className="text-[11px] text-muted-foreground/70 truncate">{card.site_address}</p>
                  )}
                </div>
              );

              return card.stop_id ? (
                <Link key={card.id} to={`/shopfloor/delivery/${card.stop_id}`}>
                  {inner}
                </Link>
              ) : (
                <div key={card.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
