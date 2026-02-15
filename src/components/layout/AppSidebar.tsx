import { Link, useLocation } from "react-router-dom";
import {
  Home, Inbox, CheckSquare, Kanban, Users, Factory, Package, Truck,
  LayoutGrid, Brain, Settings, Shield, Plug, DollarSign, Activity,
  Terminal, Lock, BarChart3, Clock, MessageSquare, Bot, Globe, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
  tourId?: string;
  lockReason?: string; // shown when user lacks access
}

export function AppSidebar() {
  const location = useLocation();
  const { roles, isAdmin } = useUserRole();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const email = user?.email || "";
  const isInternal = email.endsWith("@rebar.shop");
  const { hasAccess: isLinkedCustomer } = useCustomerPortalData();
  const isExternalEmployee = !isInternal && !!email && !isLinkedCustomer;

  // External employees get role-aware nav
  if (isExternalEmployee) {
    const hasOfficeRole = roles.includes("office" as any);
    const hasSupRole = roles.includes("shop_supervisor" as any);

    let externalNav: NavItem[];
    if (hasOfficeRole) {
      // External office (e.g. Karthick): Pipeline, Time Clock, Team Hub
      externalNav = [
        { name: "Pipeline", href: "/pipeline", icon: Kanban },
        { name: "Time Clock", href: "/timeclock", icon: Clock },
        { name: "Team Hub", href: "/team-hub", icon: MessageSquare },
      ];
    } else if (hasSupRole) {
      // External shop supervisor: expanded access
      externalNav = [
        { name: "Dashboard", href: "/home", icon: Home },
        { name: "Shop Floor", href: "/shop-floor", icon: Factory },
        { name: "Deliveries", href: "/deliveries", icon: Truck },
        { name: "Time Clock", href: "/timeclock", icon: Clock },
        { name: "Team Hub", href: "/team-hub", icon: MessageSquare },
        { name: "Tasks", href: "/tasks", icon: CheckSquare },
      ];
    } else {
      // External workshop: minimal access
      externalNav = [
        { name: "Time Clock", href: "/timeclock", icon: Clock },
        { name: "Team Hub", href: "/team-hub", icon: MessageSquare },
      ];
    }
    return (
      <aside data-tour="sidebar" className="group/sidebar w-14 hover:w-48 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full transition-all duration-200 ease-in-out overflow-hidden">
        <ScrollArea className="flex-1 py-2">
          <div className="flex flex-col gap-0.5 px-2 mt-2">
            {externalNav.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href);
              return (
                <Tooltip key={item.name} delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        "relative h-10 rounded-lg flex items-center gap-3 px-2 transition-colors whitespace-nowrap",
                        "hover:bg-sidebar-accent",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 overflow-hidden">
                        {item.name}
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs group-hover/sidebar:hidden">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </ScrollArea>
      </aside>
    );
  }

  const navGroups: NavGroup[] = [
    {
      label: "Office",
      items: [
        { name: "Dashboard", href: "/home", icon: Home, tourId: "nav-dashboard" },
        { name: "CEO Portal", href: "/ceo", icon: BarChart3, roles: ["admin"], lockReason: "Requires Admin role", tourId: "nav-ceo" },
        { name: "Website", href: "/website", icon: Globe, roles: ["admin", "office"], lockReason: "Requires Admin or Office role", tourId: "nav-website" },
        { name: "SEO", href: "/seo", icon: Search, roles: ["admin", "office"], lockReason: "Requires Admin or Office role", tourId: "nav-seo" },
        { name: "Pipeline", href: "/pipeline", icon: Kanban, roles: ["admin", "sales", "office", "accounting"], lockReason: "Requires Sales or Office role", tourId: "nav-pipeline" },
        { name: "Customers", href: "/customers", icon: Users, tourId: "nav-customers" },
        { name: "Accounting", href: "/accounting", icon: DollarSign, roles: ["admin", "accounting", "office"], lockReason: "Requires Accounting role", tourId: "nav-accounting" },
      ],
    },
    {
      label: "Production",
      items: [
        { name: "Shop Floor", href: "/shop-floor", icon: Factory, roles: ["admin", "workshop", "office"], lockReason: "Requires Workshop or Office role", tourId: "nav-shop-floor" },
        { name: "Office Tools", href: "/office", icon: LayoutGrid, roles: ["admin", "office"], lockReason: "Requires Office role", tourId: "nav-office-portal" },
      ],
    },
    {
      label: "Logistics",
      items: [
        { name: "Deliveries", href: "/deliveries", icon: Truck, roles: ["admin", "field", "office"], lockReason: "Requires Field or Office role", tourId: "nav-deliveries" },
        { name: "Inventory", href: "/office", icon: Package, roles: ["admin", "office", "workshop"], lockReason: "Requires Office or Workshop role", tourId: "nav-inventory" },
      ],
    },
    {
      label: "QA",
      items: [
        { name: "Live Monitor", href: "/shopfloor/live-monitor", icon: Activity, roles: ["admin", "office"], lockReason: "Requires Office role", tourId: "nav-live-monitor" },
        { name: "Diagnostics", href: "/admin/data-audit", icon: Terminal, roles: ["admin"], lockReason: "Requires Admin role", tourId: "nav-diagnostics" },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Inbox", href: "/inbox", icon: Inbox, badge: unreadCount || undefined, tourId: "nav-inbox" },
        { name: "Tasks", href: "/tasks", icon: CheckSquare, tourId: "nav-tasks" },
        { name: "Settings", href: "/settings", icon: Settings, tourId: "nav-settings" },
        { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"], lockReason: "Requires Admin role", tourId: "nav-admin" },
      ],
    },
  ];

  const hasAccess = (item: NavItem) => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.some((r) => roles.includes(r as any));
  };

  const handleLockedClick = (item: NavItem) => {
    toast.info(item.lockReason || "You don't have access to this module", {
      description: "Contact your administrator to request access.",
    });
  };

  return (
    <aside data-tour="sidebar" className="group/sidebar w-14 hover:w-48 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full transition-all duration-200 ease-in-out overflow-hidden">
      <ScrollArea className="flex-1 py-2">
        {navGroups.map((group) => {
          // Show group if at least one item exists (locked or not)
          const hasAnyItems = group.items.length > 0;
          if (!hasAnyItems) return null;
          return (
            <div key={group.label} className="mb-3">
              <div className="px-2 mb-1">
                <span className="text-[8px] font-bold tracking-[0.2em] text-sidebar-foreground/40 uppercase whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-2">
                {group.items.map((item) => {
                  const accessible = hasAccess(item);
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/home" && location.pathname.startsWith(item.href));

                  if (!accessible) {
                    return (
                      <Tooltip key={item.name + item.href} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleLockedClick(item)}
                            data-tour={item.tourId}
                            className="relative h-10 rounded-lg flex items-center gap-3 px-2 transition-colors whitespace-nowrap text-sidebar-foreground/30 cursor-not-allowed"
                          >
                            <item.icon className="w-[18px] h-[18px] shrink-0" />
                            <span className="text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 overflow-hidden flex items-center gap-1.5">
                              {item.name}
                              <Lock className="w-3 h-3 text-muted-foreground/50" />
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs group-hover/sidebar:hidden">
                          {item.lockReason || "Restricted"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip key={item.name + item.href} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          data-tour={item.tourId}
                          className={cn(
                            "relative h-10 rounded-lg flex items-center gap-3 px-2 transition-colors whitespace-nowrap",
                            "hover:bg-sidebar-accent",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground"
                          )}
                        >
                          <item.icon className="w-[18px] h-[18px] shrink-0" />
                          <span className="text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 overflow-hidden">
                            {item.name}
                          </span>
                          {item.badge && item.badge > 0 && (
                            <span className="absolute -top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                              {item.badge > 99 ? "99" : item.badge}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs group-hover/sidebar:hidden">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </aside>
  );
}
