import { useState, useMemo } from "react";
import { useReadyToShip, type FulfillmentChannel } from "@/hooks/useReadyToShip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, PackageCheck, HandMetal, Loader2, ArrowRight, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CHANNELS: { key: FulfillmentChannel; label: string; icon: any }[] = [
  { key: "pickup", label: "Pickup", icon: HandMetal },
  { key: "loading", label: "Loading", icon: PackageCheck },
  { key: "delivery", label: "Delivery", icon: Truck },
];

export function ReadyToShipBoard() {
  const { items, counts, loading, setChannel } = useReadyToShip();
  const [active, setActive] = useState<FulfillmentChannel>("pickup");

  const filtered = useMemo(
    () => items.filter(i => i.fulfillment_channel === active),
    [items, active]
  );

  return (
    <section id="ready" className="rounded-xl border-2 border-border bg-card p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
            <PackageCheck className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-black italic tracking-wide uppercase text-foreground">
              Ready to Ship
            </h2>
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
              Cleared items awaiting logistics action
            </p>
          </div>
        </div>
        <Badge className="bg-success/20 text-success border-success/30">
          {counts.total} ITEM{counts.total !== 1 ? "S" : ""}
        </Badge>
      </header>

      <Tabs value={active} onValueChange={v => setActive(v as FulfillmentChannel)}>
        <TabsList className="grid grid-cols-3 w-full">
          {CHANNELS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-2">
              <Icon className="w-3.5 h-3.5" />
              {label}
              <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">
                {counts[key]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map(({ key }) => (
          <TabsContent key={key} value={key} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Inbox className="w-8 h-8 opacity-40" />
                <p className="text-xs uppercase tracking-wider">No items in {key}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map(item => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">
                          {item.project_name || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {item.plan_name}
                        </span>
                        {item.mark_number && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {item.mark_number}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        {item.bar_code && <span>{item.bar_code}</span>}
                        <span>·</span>
                        <span>{item.total_pieces} pcs</span>
                        {item.cut_length_mm && (
                          <>
                            <span>·</span>
                            <span>{item.cut_length_mm}mm</span>
                          </>
                        )}
                        {item.ready_at && (
                          <>
                            <span>·</span>
                            <span>
                              Cleared {formatDistanceToNow(new Date(item.ready_at), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {CHANNELS.filter(c => c.key !== key).map(({ key: target, label, icon: Icon }) => (
                        <Button
                          key={target}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => setChannel(item.id, target)}
                        >
                          <ArrowRight className="w-3 h-3" />
                          <Icon className="w-3 h-3" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
