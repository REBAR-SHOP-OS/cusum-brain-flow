import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import {
  Factory,
  ShieldCheck,
  Send,
  PackageCheck,
  ArrowLeft,
  ClipboardList,
  Calculator,
  Cpu,
  Users,
  Layers,
  Scissors,
  Truck,
  BarChart2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { MyJobsCard } from "@/components/shopfloor/MyJobsCard";

// ── Live stats ────────────────────────────────────────────────────────────────

function useShopFloorStats() {
  const { companyId } = useCompanyId();

  return useQuery({
    queryKey: ["shopfloor-hub-stats", companyId],
    enabled: !!companyId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [machinesRes, workOrdersRes, clockRes, deliveriesRes] = await Promise.all([
        supabase
          .from("machines")
          .select("id, status")
          .eq("company_id", companyId!),
        supabase
          .from("work_orders")
          .select("id, status")
          .in("status", ["pending", "in_progress", "queued"]),
        supabase
          .from("time_clock_entries")
          .select("id")
          .gte("clock_in", todayStart.toISOString())
          .is("clock_out", null),
        supabase
          .from("deliveries")
          .select("id, status")
          .eq("company_id", companyId!)
          .gte("created_at", todayStart.toISOString()),
      ]);

      return {
        machinesRunning: (machinesRes.data ?? []).filter((m) => m.status === "running").length,
        machinesTotal: (machinesRes.data ?? []).length,
        activeWorkOrders: (workOrdersRes.data ?? []).length,
        teamOnClock: (clockRes.data ?? []).length,
        deliveriesToday: (deliveriesRes.data ?? []).length,
      };
    },
  });
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  pulse?: boolean;
}

function StatChip({ icon, label, value, pulse }: StatChipProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-border/50 min-w-0">
      <div className="relative shrink-0">
        {pulse && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
        <span className="text-primary/80">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className="text-sm font-bold leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────

interface ModuleCard {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  to: string;
  accentColor: string;
}

interface SectionDef {
  heading: string;
  badge: string;
  cards: ModuleCard[];
}

const sections: SectionDef[] = [
  {
    heading: "Pre-Production",
    badge: "INTAKE",
    cards: [
      {
        label: "Material Pool",
        subtitle: "Staging & Flow",
        icon: <Layers className="w-6 h-6" />,
        to: "/shopfloor/pool",
        accentColor: "group-hover:text-amber-400",
      },
      {
        label: "Estimation",
        subtitle: "AI Takeoff & Bids",
        icon: <Calculator className="w-6 h-6" />,
        to: "/estimation",
        accentColor: "group-hover:text-blue-400",
      },
    ],
  },
  {
    heading: "Production",
    badge: "FLOOR",
    cards: [
      {
        label: "Cutter Planning",
        subtitle: "Cut Lists & Runs",
        icon: <Scissors className="w-6 h-6" />,
        to: "/shopfloor/cutter",
        accentColor: "group-hover:text-orange-400",
      },
      {
        label: "Shop Floor",
        subtitle: "Machines & Stations",
        icon: <Factory className="w-6 h-6" />,
        to: "/shopfloor/station",
        accentColor: "group-hover:text-primary",
      },
      {
        label: "Inventory",
        subtitle: "Counts & Adjustments",
        icon: <ClipboardList className="w-6 h-6" />,
        to: "/shopfloor/inventory",
        accentColor: "group-hover:text-teal-400",
      },
    ],
  },
  {
    heading: "Quality & Dispatch",
    badge: "OUTPUT",
    cards: [
      {
        label: "Clearance",
        subtitle: "QC & Evidence",
        icon: <ShieldCheck className="w-6 h-6" />,
        to: "/shopfloor/clearance",
        accentColor: "group-hover:text-green-400",
      },
      {
        label: "Loading Station",
        subtitle: "Load & Evidence",
        icon: <PackageCheck className="w-6 h-6" />,
        to: "/shopfloor/loading",
        accentColor: "group-hover:text-yellow-400",
      },
      {
        label: "Delivery",
        subtitle: "Dispatch & Tracking",
        icon: <Truck className="w-6 h-6" />,
        to: "/deliveries",
        accentColor: "group-hover:text-sky-400",
      },
      {
        label: "Pickup Station",
        subtitle: "Customer Collection",
        icon: <Send className="w-6 h-6" />,
        to: "/shopfloor/pickup",
        accentColor: "group-hover:text-rose-400",
      },
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShopFloor() {
  const { data: stats, isLoading: statsLoading } = useShopFloorStats();

  return (
    <div className="relative flex flex-col items-center min-h-screen bg-background overflow-hidden">
      {/* Radial glow background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-destructive/10 blur-[200px]" />
        <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 w-full flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-foreground uppercase leading-none">ERP Command Hub</h2>
            <p className="text-[9px] tracking-widest text-primary/70 uppercase mt-0.5">Production Environment Active</p>
          </div>
        </div>
        <Link
          to="/home"
          className="flex items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase"
        >
          <ArrowLeft className="w-3 h-3" />
          Home
        </Link>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-col w-full max-w-4xl px-4 py-6 gap-6">

        {/* Title */}
        <div className="text-center pt-2">
          <h1 className="text-3xl sm:text-4xl font-black italic text-foreground tracking-tight">
            REBAR SHOP ERP
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-primary/70 uppercase mt-1">
            Full Operations Platform
          </p>
        </div>

        {/* Live Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {statsLoading ? (
            <div className="col-span-4 flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              <StatChip
                icon={<Cpu className="w-4 h-4" />}
                label="Machines Running"
                value={`${stats.machinesRunning}/${stats.machinesTotal}`}
                pulse={stats.machinesRunning > 0}
              />
              <StatChip
                icon={<Factory className="w-4 h-4" />}
                label="Active Work Orders"
                value={stats.activeWorkOrders}
                pulse={stats.activeWorkOrders > 0}
              />
              <StatChip
                icon={<Users className="w-4 h-4" />}
                label="Team On Clock"
                value={stats.teamOnClock}
                pulse={stats.teamOnClock > 0}
              />
              <StatChip
                icon={<BarChart2 className="w-4 h-4" />}
                label="Deliveries Today"
                value={stats.deliveriesToday}
              />
            </>
          ) : null}
        </div>

        {/* My Jobs Card */}
        <MyJobsCard />

        {/* Workflow Sections */}
        {sections.map((section, si) => (
          <div key={section.heading} className="space-y-2">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold tracking-[0.25em] text-primary/60 uppercase border border-primary/30 rounded px-1.5 py-0.5">
                {section.badge}
              </span>
              <h3 className="text-sm font-bold tracking-wider text-foreground/80 uppercase">
                {section.heading}
              </h3>
              {si < sections.length - 1 && (
                <div className="flex-1 h-px bg-border/40" />
              )}
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {section.cards.map((card) => (
                <Link
                  key={`${section.heading}-${card.label}`}
                  to={card.to}
                  className="group relative flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm hover:bg-card/70 hover:border-primary/30 transition-all duration-200 hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.25)]"
                >
                  <div className={`text-muted-foreground transition-colors ${card.accentColor}`}>
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold tracking-wide text-foreground/90 group-hover:text-foreground uppercase leading-tight truncate">
                      {card.label}
                    </p>
                    <p className="text-[9px] tracking-wider text-muted-foreground/70 uppercase mt-0.5 truncate">
                      {card.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Footer spacing */}
        <div className="h-4" />
      </div>
    </div>
  );
}
