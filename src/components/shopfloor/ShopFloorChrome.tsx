import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  IndustrialFrame,
  IndustrialTabs,
  WorkspaceHeader,
} from "@/components/industrial/IndustrialShell";

type RouteItem = { id: string; label: string; path: string };

const SHOP_FLOOR_TABS: RouteItem[] = [
  { id: "hub",         label: "Hub",         path: "/shop-floor" },
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
 * Industrial chrome for Shop Floor routes — REBAR OS Core parity.
 * Wraps page content in `.industrial` dark theme + sticky tab strip.
 */
export function ShopFloorChrome({
  eyebrow = "Production",
  title,
  subtitle,
  actions,
  status,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = detectActive(location.pathname);

  return (
    <IndustrialFrame>
      <WorkspaceHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={actions}
        status={status}
      />
      <IndustrialTabs<string>
        value={active}
        onChange={(id) => {
          const route = SHOP_FLOOR_TABS.find((item) => item.id === id);
          if (route) navigate(route.path);
        }}
        items={SHOP_FLOOR_TABS.map((item) => ({ id: item.id, label: item.label }))}
      />
      <div className="mt-2">{children}</div>
    </IndustrialFrame>
  );
}
