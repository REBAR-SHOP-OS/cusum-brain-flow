import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IndustrialTabs } from "@/components/industrial/IndustrialShell";


type RouteItem = { id: string; label: string; path: string };

const SHOP_FLOOR_TABS: RouteItem[] = [
  
  { id: "pool",        label: "Pool",        path: "/shopfloor/pool" },
  { id: "station",     label: "Stations",    path: "/shopfloor/station" },
  { id: "cutter",      label: "Cutter",      path: "/shopfloor/cutter" },
  { id: "clearance",   label: "Clearance",   path: "/shopfloor/clearance" },
  { id: "loading",     label: "Loading",     path: "/shopfloor/loading" },
  { id: "pickup",      label: "Pickup",      path: "/shopfloor/pickup" },
  { id: "delivery",    label: "Delivery",    path: "/shopfloor/delivery-ops" },
  { id: "inventory",   label: "Inventory",   path: "/shopfloor/inventory" },
  { id: "camera",      label: "Camera AI",   path: "/shopfloor/camera-intelligence" },
];

function detectActive(pathname: string): string {
  const matched = [...SHOP_FLOOR_TABS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  return matched?.id ?? SHOP_FLOOR_TABS[0].id;
}

/**
 * Industrial chrome wrapper for shop-floor sub-routes.
 * Applies `.industrial` dark theme + sticky tab strip WITHOUT a workspace
 * header — the page keeps whatever internal header it already renders.
 * Use this at the route layer so page internals stay untouched.
 */
export function ShopFloorShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = detectActive(location.pathname);

  return (
    <div className="industrial flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
        <IndustrialTabs<string>
          value={active}
          onChange={(id) => {
            const route = SHOP_FLOOR_TABS.find((item) => item.id === id);
            if (route) navigate(route.path);
          }}
          items={SHOP_FLOOR_TABS.map((item) => ({ id: item.id, label: item.label }))}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

