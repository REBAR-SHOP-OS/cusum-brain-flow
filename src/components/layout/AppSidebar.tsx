import { Link, useLocation } from "react-router-dom";
import {
  Home, Inbox, CheckSquare, Kanban, Users, Factory, Package, Truck,
  LayoutGrid, Brain, Settings, Shield, Plug, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[]; // if set, only show for these roles (admin always sees all)
  badge?: number;
  tourId?: string;
}

export function AppSidebar() {
  const location = useLocation();
  const { roles, isAdmin } = useUserRole();
  const { unreadCount } = useNotifications();

  const navGroups: NavGroup[] = [
    {
      label: "Core",
      items: [
        { name: "Dashboard", href: "/home", icon: Home, tourId: "nav-dashboard" },
        { name: "Inbox", href: "/inbox", icon: Inbox, badge: unreadCount || undefined, tourId: "nav-inbox" },
        { name: "Tasks", href: "/tasks", icon: CheckSquare, tourId: "nav-tasks" },
        
      ],
    },
    {
      label: "Sales",
      items: [
        { name: "Pipeline", href: "/pipeline", icon: Kanban, roles: ["admin", "sales", "office"], tourId: "nav-pipeline" },
        { name: "Customers", href: "/customers", icon: Users, tourId: "nav-customers" },
        { name: "Accounting", href: "/accounting", icon: DollarSign, roles: ["admin", "accounting", "office"], tourId: "nav-accounting" },
      ],
    },
    {
      label: "Operations",
      items: [
        { name: "Shop Floor", href: "/shop-floor", icon: Factory, roles: ["admin", "workshop", "office"], tourId: "nav-shop-floor" },
        { name: "Office Portal", href: "/office", icon: LayoutGrid, roles: ["admin", "office"], tourId: "nav-office-portal" },
        { name: "Inventory", href: "/office", icon: Package, roles: ["admin", "office", "workshop"], tourId: "nav-inventory" },
        { name: "Deliveries", href: "/deliveries", icon: Truck, roles: ["admin", "field", "office"], tourId: "nav-deliveries" },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Brain", href: "/brain", icon: Brain, tourId: "nav-brain" },
        { name: "Integrations", href: "/integrations", icon: Plug, tourId: "nav-integrations" },
        { name: "Settings", href: "/settings", icon: Settings, tourId: "nav-settings" },
      ],
    },
    {
      label: "Admin",
      items: [
        { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"], tourId: "nav-admin" },
      ],
    },
  ];

  const isVisible = (item: NavItem) => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.some((r) => roles.includes(r as any));
  };

  return (
    <aside data-tour="sidebar" className="group/sidebar w-14 hover:w-48 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full transition-all duration-200 ease-in-out overflow-hidden">
      <ScrollArea className="flex-1 py-2">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-3">
              <div className="px-2 mb-1">
                <span className="text-[8px] font-bold tracking-[0.2em] text-sidebar-foreground/40 uppercase whitespace-nowrap">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-2">
                {visibleItems.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/home" && location.pathname.startsWith(item.href));
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
