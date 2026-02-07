import { Link, useLocation } from "react-router-dom";
import {
  Home, Inbox, CheckSquare, Kanban, Users, Factory, Package, Truck,
  LayoutGrid, Brain, Settings, Shield, Phone, Bell, History,
  BarChart3,
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
}

export function AppSidebar() {
  const location = useLocation();
  const { roles, isAdmin } = useUserRole();
  const { unreadCount } = useNotifications();

  const navGroups: NavGroup[] = [
    {
      label: "Core",
      items: [
        { name: "Dashboard", href: "/home", icon: Home },
        { name: "Inbox", href: "/inbox", icon: Inbox, badge: unreadCount || undefined },
        { name: "Tasks", href: "/tasks", icon: CheckSquare },
        { name: "Calls", href: "/phonecalls", icon: Phone },
      ],
    },
    {
      label: "Sales",
      items: [
        { name: "Pipeline", href: "/pipeline", icon: Kanban, roles: ["admin", "sales", "office"] },
        { name: "Customers", href: "/customers", icon: Users },
      ],
    },
    {
      label: "Operations",
      items: [
        { name: "Shop Floor", href: "/shop-floor", icon: Factory, roles: ["admin", "workshop", "office"] },
        { name: "Office Portal", href: "/office", icon: LayoutGrid, roles: ["admin", "office"] },
        { name: "Inventory", href: "/office", icon: Package, roles: ["admin", "office", "workshop"] },
        { name: "Deliveries", href: "/deliveries", icon: Truck, roles: ["admin", "field", "office"] },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Brain", href: "/brain", icon: Brain },
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
    {
      label: "Admin",
      items: [
        { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"] },
      ],
    },
  ];

  const isVisible = (item: NavItem) => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.some((r) => roles.includes(r as any));
  };

  return (
    <aside className="w-14 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <ScrollArea className="flex-1 py-2">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-3">
              <div className="px-2 mb-1">
                <span className="text-[8px] font-bold tracking-[0.2em] text-sidebar-foreground/40 uppercase">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/home" && location.pathname.startsWith(item.href));
                  return (
                    <Tooltip key={item.name + item.href} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          className={cn(
                            "relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                            "hover:bg-sidebar-accent",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground"
                          )}
                        >
                          <item.icon className="w-[18px] h-[18px]" />
                          {item.badge && item.badge > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                              {item.badge > 99 ? "99" : item.badge}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
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
