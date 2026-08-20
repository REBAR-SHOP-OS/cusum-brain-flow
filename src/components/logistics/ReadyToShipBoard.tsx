import { useState, useMemo } from "react";
import { useReadyToShip, type FulfillmentChannel, type ReadyItem } from "@/hooks/useReadyToShip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck,
  PackageCheck,
  HandMetal,
  Loader2,
  ArrowRight,
  Inbox,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CHANNELS: { key: FulfillmentChannel; label: string; icon: any }[] = [
  { key: "pickup", label: "Pickup", icon: HandMetal },
  { key: "loading", label: "Loading", icon: PackageCheck },
  { key: "delivery", label: "Delivery", icon: Truck },
];

interface PlanGroup {
  planKey: string;
  planName: string;
  projectName: string | null;
  items: ReadyItem[];
}
interface CustomerGroup {
  customerName: string;
  plans: PlanGroup[];
  totalItems: number;
}

function groupByCustomer(items: ReadyItem[]): CustomerGroup[] {
  const byCustomer = new Map<string, Map<string, PlanGroup>>();
  for (const it of items) {
    const cname = it.customer_name || "Unassigned";
    const planKey = it.cut_plan_id || "__unassigned__";
    if (!byCustomer.has(cname)) byCustomer.set(cname, new Map());
    const plans = byCustomer.get(cname)!;
    if (!plans.has(planKey)) {
      plans.set(planKey, {
        planKey,
        planName: it.plan_name || "Unnamed manifest",
        projectName: it.project_name,
        items: [],
      });
    }
    plans.get(planKey)!.items.push(it);
  }
  const newest = (its: ReadyItem[]) =>
    Math.max(0, ...its.map((i) => (i.ready_at ? new Date(i.ready_at).getTime() : 0)));
  return [...byCustomer.entries()]
    .map(([customerName, plansMap]) => {
      // Newest plan first within each customer
      const plans = [...plansMap.values()].sort((a, b) => newest(b.items) - newest(a.items));
      const totalItems = plans.reduce((n, p) => n + p.items.length, 0);
      return { customerName, plans, totalItems };
    })
    // Newest customer (by their most recent ready item) first; Unassigned last
    .sort((a, b) => {
      if (a.customerName === "Unassigned") return 1;
      if (b.customerName === "Unassigned") return -1;
      return newest(b.plans.flatMap((p) => p.items)) - newest(a.plans.flatMap((p) => p.items));
    });
}

export function ReadyToShipBoard() {
  const { items, counts, loading, setChannel } = useReadyToShip();
  const [active, setActive] = useState<FulfillmentChannel>("pickup");
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => items.filter((i) => i.fulfillment_channel === active),
    [items, active]
  );
  const customerGroups = useMemo(() => groupByCustomer(filtered), [filtered]);

  const activePlan = useMemo(() => {
    if (!selectedPlanKey) return null;
    for (const cg of customerGroups) {
      const p = cg.plans.find((pp) => pp.planKey === selectedPlanKey);
      if (p) return { customer: cg.customerName, plan: p };
    }
    return null;
  }, [customerGroups, selectedPlanKey]);

  const toggleCustomer = (name: string) =>
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

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

      <Tabs
        value={active}
        onValueChange={(v) => {
          setActive(v as FulfillmentChannel);
          setSelectedPlanKey(null);
        }}
      >
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
            ) : active === key && activePlan ? (
              <PlanItemsView
                channel={key}
                customerName={activePlan.customer}
                plan={activePlan.plan}
                onBack={() => setSelectedPlanKey(null)}
                onMove={(itemId, target) => setChannel(itemId, target)}
              />
            ) : (
              active === key && (
                <CustomerTree
                  groups={customerGroups}
                  expanded={expandedCustomers}
                  toggle={toggleCustomer}
                  onSelectPlan={(planKey) => setSelectedPlanKey(planKey)}
                />
              )
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function CustomerTree({
  groups,
  expanded,
  toggle,
  onSelectPlan,
}: {
  groups: CustomerGroup[];
  expanded: Set<string>;
  toggle: (name: string) => void;
  onSelectPlan: (planKey: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select a customer to view its ready-to-ship manifests.
      </p>
      {groups.map(({ customerName, plans, totalItems }) => {
        const isSingle = plans.length === 1;
        const isExpanded = expanded.has(customerName) || isSingle;
        return (
          <div
            key={customerName}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              onClick={() => {
                if (isSingle) onSelectPlan(plans[0].planKey);
                else toggle(customerName);
              }}
              className="w-full hover:bg-muted/50 transition-colors p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <PackageCheck className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0 flex flex-col">
                  <span className="text-base font-bold uppercase tracking-wider text-foreground truncate">
                    {customerName}
                  </span>
                  <span className="text-[10px] font-bold tracking-wide uppercase text-success/80 truncate">
                    {plans.length} manifest{plans.length !== 1 ? "s" : ""} · {totalItems} item
                    {totalItems !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <ChevronRight
                className={`w-5 h-5 text-muted-foreground transition-transform ${
                  isExpanded && !isSingle ? "rotate-90" : ""
                }`}
              />
            </button>

            {isExpanded && !isSingle && (
              <div className="border-t border-border bg-background/40">
                {plans.map((plan) => (
                  <button
                    key={plan.planKey}
                    onClick={() => onSelectPlan(plan.planKey)}
                    className="w-full hover:bg-muted/50 transition-colors px-4 py-3 flex items-center justify-between text-left border-t border-border/50 first:border-t-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 pl-6">
                      <div className="min-w-0 flex flex-col">
                        <span className="text-[12px] text-foreground truncate">
                          └─ {plan.projectName || plan.planName}
                        </span>
                        <span className="text-[10px] font-bold tracking-wide uppercase text-success/70 truncate">
                          {plan.items.length} item{plan.items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanItemsView({
  channel,
  customerName,
  plan,
  onBack,
  onMove,
}: {
  channel: FulfillmentChannel;
  customerName: string;
  plan: PlanGroup;
  onBack: () => void;
  onMove: (itemId: string, target: FulfillmentChannel) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onBack}>
          ← Back
        </Button>
        <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
          {customerName}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="text-xs text-foreground truncate">
          {plan.projectName || plan.planName}
        </span>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {plan.items.length} item{plan.items.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <ul className="space-y-2">
        {plan.items.map((item, idx) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground truncate">
                  {item.plan_name || "—"}
                </span>
                {item.mark_number && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {item.mark_number}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                  #{idx + 1}
                </Badge>
                {item.drawing_ref && (
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    DWG {item.drawing_ref}
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
                      Cleared{" "}
                      {formatDistanceToNow(new Date(item.ready_at), { addSuffix: true })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {CHANNELS.filter((c) => c.key !== channel).map(
                ({ key: target, label, icon: Icon }) => (
                  <Button
                    key={target}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px] gap-1"
                    onClick={() => onMove(item.id, target)}
                  >
                    <ArrowRight className="w-3 h-3" />
                    <Icon className="w-3 h-3" />
                    {label}
                  </Button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
