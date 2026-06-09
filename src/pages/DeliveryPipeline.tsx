import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useIntake } from "@/contexts/IntakeContext";
import { IntakeSelector } from "@/components/shopfloor/IntakeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Truck,
  PackageCheck,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDot,
  AlertTriangle,
} from "lucide-react";

type Delivery = {
  id: string;
  delivery_number: string | null;
  status: string;
  scheduled_date: string | null;
  driver_name: string | null;
  vehicle: string | null;
  created_at: string;
  order_id: string | null;
};

// Canonical ordering — any unknown statuses are appended at the end.
const STAGE_ORDER = [
  "pending",
  "queued",
  "staged",
  "out_for_delivery",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

const STAGE_META: Record<
  string,
  { label: string; icon: typeof Truck; tone: string }
> = {
  pending: { label: "Pending", icon: Clock, tone: "bg-muted text-foreground" },
  queued: { label: "Queued", icon: CircleDot, tone: "bg-muted text-foreground" },
  staged: { label: "Staged", icon: Package, tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  out_for_delivery: {
    label: "Out for Delivery",
    icon: Truck,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  in_transit: {
    label: "In Transit",
    icon: Truck,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    tone: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    tone: "bg-destructive/15 text-destructive",
  },
};

function metaFor(status: string) {
  return (
    STAGE_META[status] ?? {
      label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: PackageCheck,
      tone: "bg-muted text-foreground",
    }
  );
}

export default function DeliveryPipeline() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["delivery-pipeline", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Delivery[]> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "id, delivery_number, status, scheduled_date, driver_name, vehicle, created_at, order_id"
        )
        .eq("company_id", companyId!)
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Delivery[];
    },
  });

  // Open exception counts per delivery — drives the inline warning badge.
  const { data: openExceptions = [] } = useQuery({
    queryKey: ["delivery-exceptions-open", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_exceptions")
        .select("delivery_id, exception_type")
        .eq("company_id", companyId!)
        .is("resolved_at", null);
      if (error) throw error;
      return (data ?? []) as { delivery_id: string; exception_type: string }[];
    },
  });

  const exceptionCountByDelivery = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of openExceptions) {
      m.set(e.delivery_id, (m.get(e.delivery_id) ?? 0) + 1);
    }
    return m;
  }, [openExceptions]);

  const stages = useMemo(() => {
    const groups = new Map<string, Delivery[]>();
    for (const d of deliveries) {
      const k = d.status || "unknown";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(d);
    }
    const ordered: { status: string; items: Delivery[] }[] = [];
    for (const s of STAGE_ORDER) {
      if (groups.has(s)) {
        ordered.push({ status: s, items: groups.get(s)! });
        groups.delete(s);
      }
    }
    for (const [status, items] of groups) ordered.push({ status, items });
    return ordered;
  }, [deliveries]);

  const total = deliveries.length;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="w-6 h-6" /> Delivery Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Read-only timeline of deliveries grouped by current status.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {total} {total === 1 ? "delivery" : "deliveries"}
        </Badge>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No deliveries yet.
          </CardContent>
        </Card>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-8">
          {stages.map(({ status, items }) => {
            const meta = metaFor(status);
            const Icon = meta.icon;
            return (
              <li key={status} className="ml-6">
                <span
                  className={`absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background ${meta.tone}`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{meta.label}</span>
                      <Badge variant="secondary">{items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((d) => {
                      const openExc = exceptionCountByDelivery.get(d.id) ?? 0;
                      return (
                      <button
                        key={d.id}
                        onClick={() => navigate(`/shopfloor/delivery/${d.id}`)}
                        className="w-full text-left rounded-md border border-border bg-card hover:bg-accent/40 transition-colors px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1"
                      >
                        <span className="font-medium tabular-nums">
                          {d.delivery_number ?? d.id.slice(0, 8)}
                        </span>
                        {openExc > 0 && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-destructive/40 text-destructive"
                            title={`${openExc} open exception${openExc === 1 ? "" : "s"}`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {openExc} exception{openExc === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {d.scheduled_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(d.scheduled_date), "MMM d, yyyy")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Driver: {d.driver_name ?? "Unassigned"}
                        </span>
                        {d.vehicle && (
                          <span className="text-xs text-muted-foreground">
                            Vehicle: {d.vehicle}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Created{" "}
                          {format(new Date(d.created_at), "MMM d")}
                        </span>
                      </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
