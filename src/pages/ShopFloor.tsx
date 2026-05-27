import { Link } from "react-router-dom";
import {
  Factory,
  ShieldCheck,
  PackageCheck,
  ClipboardList,
  Truck,
  Camera,
  Scissors,
} from "lucide-react";
import { MyJobsCard } from "@/components/shopfloor/MyJobsCard";
import { ShopFloorChrome } from "@/components/shopfloor/ShopFloorChrome";
import {
  IndustrialCard,
  SectionHead,
} from "@/components/industrial/IndustrialShell";

interface HubCard {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  to: string;
}

const hubCards: HubCard[] = [
  { label: "Material Pool", subtitle: "Staging & flow",          icon: <Factory className="h-5 w-5" />,      to: "/shopfloor/pool" },
  { label: "Stations",      subtitle: "Machines & operators",    icon: <Factory className="h-5 w-5" />,      to: "/shopfloor/station" },
  { label: "Cutter Plan",   subtitle: "Cut list & queue",        icon: <Scissors className="h-5 w-5" />,     to: "/shopfloor/cutter" },
  { label: "Clearance",     subtitle: "QC & evidence",           icon: <ShieldCheck className="h-5 w-5" />,  to: "/shopfloor/clearance" },
  { label: "Loading St.",   subtitle: "Load & evidence",         icon: <PackageCheck className="h-5 w-5" />, to: "/shopfloor/loading" },
  { label: "Pickup St.",    subtitle: "Customer collection",     icon: <PackageCheck className="h-5 w-5" />, to: "/shopfloor/pickup" },
  { label: "Delivery Ops",  subtitle: "Dispatch & drop-off",     icon: <Truck className="h-5 w-5" />,        to: "/shopfloor/delivery-ops" },
  { label: "Inventory",     subtitle: "Counts & adjustments",    icon: <ClipboardList className="h-5 w-5" />, to: "/shopfloor/inventory" },
  { label: "Camera AI",     subtitle: "Vision & dispatch",       icon: <Camera className="h-5 w-5" />,       to: "/shopfloor/camera-intelligence" },
];

export default function ShopFloor() {
  return (
    <ShopFloorChrome
      eyebrow="Production"
      title="Shop Floor"
      subtitle="Live command center for stations, queues, clearance and dispatch."
      status={
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Production environment active
        </span>
      }
    >
      <div className="space-y-6">
        <section>
          <SectionHead title="My Jobs" subtitle="Assigned to you across all stations" />
          <MyJobsCard />
        </section>

        <section>
          <SectionHead title="Workspaces" subtitle="Jump to any shop-floor surface" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {hubCards.map((card) => (
              <Link key={card.label} to={card.to} className="block focus:outline-none">
                <IndustrialCard interactive className="group flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
                      {card.icon}
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground group-hover:text-primary">
                      Open
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-foreground">
                      {card.label}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {card.subtitle}
                    </div>
                  </div>
                </IndustrialCard>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ShopFloorChrome>
  );
}
