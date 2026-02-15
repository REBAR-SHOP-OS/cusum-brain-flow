import { useLocation } from "react-router-dom";

interface ActiveModule {
  module: string;
  moduleRoute: string;
  breadcrumb: { label: string; href: string }[];
}

const ROUTE_MAP: Record<string, { module: string; moduleRoute: string; page?: string }> = {
  "/home": { module: "Dashboard", moduleRoute: "/home" },
  "/pipeline": { module: "CRM", moduleRoute: "/pipeline", page: "Pipeline" },
  "/prospecting": { module: "CRM", moduleRoute: "/pipeline", page: "Prospecting" },
  "/customers": { module: "CRM", moduleRoute: "/pipeline", page: "Customers" },
  "/shop-floor": { module: "Manufacturing", moduleRoute: "/shop-floor", page: "Shop Floor" },
  "/shopfloor/station": { module: "Manufacturing", moduleRoute: "/shop-floor", page: "Station" },
  "/deliveries": { module: "Logistics", moduleRoute: "/deliveries", page: "Deliveries" },
  "/office": { module: "Office Portal", moduleRoute: "/office" },
  "/admin": { module: "Administration", moduleRoute: "/admin" },
  "/settings": { module: "Settings", moduleRoute: "/settings" },
  "/inbox": { module: "Messaging", moduleRoute: "/inbox", page: "Inbox" },
  "/tasks": { module: "Messaging", moduleRoute: "/inbox", page: "Tasks" },
  "/brain": { module: "Knowledge", moduleRoute: "/brain" },
  "/phonecalls": { module: "Communications", moduleRoute: "/phonecalls", page: "Phone Calls" },
  "/website": { module: "Job Site", moduleRoute: "/website" },
  "/seo": { module: "SEO", moduleRoute: "/seo" },
};

export function useActiveModule(): ActiveModule {
  const { pathname } = useLocation();

  // Find best match (longest prefix)
  let best = ROUTE_MAP["/home"]!;
  let bestLen = 0;
  for (const [route, info] of Object.entries(ROUTE_MAP)) {
    if (pathname.startsWith(route) && route.length > bestLen) {
      best = info;
      bestLen = route.length;
    }
  }

  const breadcrumb: { label: string; href: string }[] = [
    { label: best.module, href: best.moduleRoute },
  ];
  if (best.page) {
    breadcrumb.push({ label: best.page, href: pathname });
  }

  return {
    module: best.module,
    moduleRoute: best.moduleRoute,
    breadcrumb,
  };
}
