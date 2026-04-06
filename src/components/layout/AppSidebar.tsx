import { useState } from "react";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Inbox, CheckSquare, Kanban, Users, Factory, Package, Truck,
  LayoutGrid, Workflow, Brain, Settings, Shield, Plug, DollarSign, Activity,
  Terminal, Lock, BarChart3, Monitor, Clock, MessageSquare, Bot, Globe, Search, Headset, Zap, Maximize, PanelLeftClose, PanelLeft, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useMemo } from "react";

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  allowedEmails?: string[];
  blockedEmails?: string[];
  badge?: number;
  tourId?: string;
  lockReason?: string; // shown when user lacks access
}

export function AppSidebar() {
  const location = useLocation();
  const { roles, isAdmin } = useUserRole();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const [pinned, setPinned] = useState(() => localStorage.getItem("sidebar_pinned") === "true");
  const email = user?.email || "";
  const isInternal = email.endsWith("@rebar.shop");
  const { hasAccess: isLinkedCustomer } = useCustomerPortalData();
  const isExternalEmployee = !isInternal && !!email && !isLinkedCustomer;
  const isAppBuilderRoute = location.pathname === "/app-builder" || location.pathname.startsWith("/app-builder/");
  const sidebarClasses = useMemo(
    () =>
      cn(
        "group/sidebar shrink-0 border-r flex flex-col h-full transition-all duration-200 ease-in-out overflow-hidden",
        isAppBuilderRoute
          ? "bg-[hsl(var(--dashboard-reference-sidebar))] border-[hsl(var(--dashboard-reference-border))]"
          : "bg-sidebar border-sidebar-border",
        pinned ? "w-48" : "w-14 hover:w-48",
      ),
    [isAppBuilderRoute, pinned],
  );
  const sectionLabelClasses = isAppBuilderRoute
    ? "text-[8px] font-bold tracking-[0.2em] text-white/28 uppercase whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200"
    : "text-[8px] font-bold tracking-[0.2em] text-sidebar-foreground/40 uppercase whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200";
  const inactiveItemClasses = isAppBuilderRoute ? "text-white/72 hover:bg-white/5" : "text-sidebar-foreground hover:bg-sidebar-accent";
  const activeItemClasses = isAppBuilderRoute
    ? "bg-white/8 text-white shadow-[inset_0_0_0_1px_hsl(var(--dashboard-reference-border))]"
    : "bg-sidebar-accent text-sidebar-accent-foreground";
  const lockedItemClasses = isAppBuilderRoute ? "text-white/25" : "text-sidebar-foreground/30";

  // AI bot account: only Dashboard + Shop Floor
  if (email === "ai@rebar.shop") {
    const aiNav: NavItem[] = [
      { name: "Kiosk", href: "/timeclock?kiosk=1", icon: Maximize },
      { name: "Shop Floor", href: "/shop-floor", icon: Factory },
      { name: "Team Hub", href: "/team-hub", icon: Users },
    ];
    return (
      <aside data-tour="sidebar" className={cn("group/sidebar w-14 hover:w-48 shrink-0 border-r flex flex-col h-full transition-all duration-200 ease-in-out overflow-hidden", isAppBuilderRoute ? "bg-[hsl(var(--dashboard-reference-sidebar))] border-[hsl(var(--dashboard-reference-border))]" : "bg-sidebar border-sidebar-border")}>
        <ScrollArea className="flex-1 py-2">
          <div className="flex flex-col gap-0.5 px-2 mt-2">
            {aiNav.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href);
              return (
                <Tooltip key={item.name} delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        "relative h-10 rounded-lg flex items-center gap-3 px-2 transition-colors whitespace-nowrap",
                        isActive ? activeItemClasses : inactiveItemClasses
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
        
        { name: "Time Clock", href: "/timeclock", icon: Clock },
        { name: "Team Hub", href: "/team-hub", icon: MessageSquare },
        { name: "Business Tasks", href: "/tasks", icon: CheckSquare },
      ];
    } else {
      // External workshop: minimal access
      externalNav = [
        { name: "Time Clock", href: "/timeclock", icon: Clock },
        { name: "Team Hub", href: "/team-hub", icon: MessageSquare },
      ];
    }
    return (
      <aside data-tour="sidebar" className={cn("group/sidebar w-14 hover:w-48 shrink-0 border-r flex flex-col h-full transition-all duration-200 ease-in-out overflow-hidden", isAppBuilderRoute ? "bg-[hsl(var(--dashboard-reference-sidebar))] border-[hsl(var(--dashboard-reference-border))]" : "bg-sidebar border-sidebar-border")}>
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
                        isActive ? activeItemClasses : inactiveItemClasses
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
        { name: "Inbox", href: "/inbox-manager", icon: Inbox, roles: ["admin", "office"], lockReason: "Requires Admin or Office role", tourId: "nav-inbox" },
        { name: "Team Hub", href: "/team-hub", icon: MessageSquare, tourId: "nav-team-hub" },
        { name: "Business Tasks", href: "/tasks", icon: CheckSquare, tourId: "nav-tasks" },
        { name: "Live Monitor", href: "/live-monitor", icon: Monitor, roles: ["admin", "office", "sales"], lockReason: "Requires Admin, Office or Sales role", tourId: "nav-live-monitor" },
        { name: "CEO Portal", href: "/ceo", icon: BarChart3, allowedEmails: [...ACCESS_POLICIES.ceoPortalAccess], lockReason: "Requires Super Admin", tourId: "nav-ceo" },
        { name: "Support", href: "/support-inbox", icon: Headset, roles: ["admin", "office"], lockReason: "Requires Admin or Office role", tourId: "nav-support" },
        { name: "Pipeline", href: "/pipeline", icon: Kanban, roles: ["admin", "sales", "office", "accounting"], lockReason: "Requires Sales or Office role", tourId: "nav-pipeline" },
        { name: "Lead Scoring", href: "/lead-scoring", icon: Zap, roles: ["admin", "sales", "office"], lockReason: "Requires Sales or Admin role", tourId: "nav-lead-scoring" },
        { name: "Customers", href: "/customers", icon: Users, tourId: "nav-customers", blockedEmails: [...ACCESS_POLICIES.blockedFromCustomers] },
        { name: "Accounting", href: "/accounting", icon: DollarSign, allowedEmails: [...ACCESS_POLICIES.accountingAccess], lockReason: "Restricted access", tourId: "nav-accounting" },
        { name: "Sales", href: "/sales", icon: TrendingUp, roles: ["admin", "sales", "office"], lockReason: "Requires Sales or Office role", tourId: "nav-sales" },
      ],
    },
    {
      label: "Production",
      items: [
        { name: "Shop Floor", href: "/shop-floor", icon: Factory, roles: ["admin", "workshop", "office"], lockReason: "Requires Workshop or Office role", tourId: "nav-shop-floor" },
        { name: "Time Clock", href: "/timeclock", icon: Clock, roles: ["admin", "workshop", "office"], lockReason: "Requires Workshop or Office role" },
        { name: "Office Tools", href: "/office", icon: LayoutGrid, roles: ["admin", "office"], lockReason: "Requires Office role", tourId: "nav-office-portal" },
      ],
    },
    {
      label: "Logistics",
      items: [
        { name: "Inventory", href: "/shopfloor/inventory", icon: Package, roles: ["admin", "office", "workshop"], lockReason: "Requires Office or Workshop role", tourId: "nav-inventory" },
      ],
    },
    {
      label: "QA",
      items: [
        
        { name: "Diagnostics", href: "/admin/data-audit", icon: Terminal, roles: ["admin"], lockReason: "Requires Admin role", tourId: "nav-diagnostics" },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Architecture", href: "/architecture", icon: Workflow, tourId: "nav-architecture" },
        { name: "Settings", href: "/settings", icon: Settings, tourId: "nav-settings" },
        { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"], lockReason: "Requires Admin role", tourId: "nav-admin" },
      ],
    },
  ];

  const { isSuperAdmin } = useSuperAdmin();

  const hasAccess = (item: NavItem) => {
    if (isSuperAdmin) return true;
    if (item.blockedEmails?.includes(email.toLowerCase())) return false;
    if (item.allowedEmails) {
      return item.allowedEmails.includes(email.toLowerCase());
    }
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.some((r) => roles.includes(r as any));
  };

  const handleLockedClick = (item: NavItem) => {
    toast.info(item.lockReason || "You don't have access to this module", {
      description: "Contact your administrator to request access.",
    });
  };

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem("sidebar_pinned", String(next));
  };

  return (
    <aside data-tour="sidebar" className={sidebarClasses}>
      <ScrollArea className="flex-1 py-2">
        {navGroups.map((group) => {
          // Show group if at least one item exists (locked or not)
          const hasAnyItems = group.items.length > 0;
          if (!hasAnyItems) return null;
          return (
            <div key={group.label} className="mb-3">
              <div className="px-2 mb-1">
                <span className={sectionLabelClasses}>
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
                    // Items restricted by allowedEmails should be completely hidden
                    if (item.allowedEmails) return null;
                    return (
                      <Tooltip key={item.name + item.href} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleLockedClick(item)}
                            data-tour={item.tourId}
                            className={cn("relative h-10 rounded-lg flex items-center gap-3 px-2 transition-colors whitespace-nowrap cursor-not-allowed", lockedItemClasses)}
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
                            isActive ? activeItemClasses : inactiveItemClasses
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
      <div className={cn("px-2 py-2 border-t", isAppBuilderRoute ? "border-[hsl(var(--dashboard-reference-border))]" : "border-sidebar-border")}>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              onClick={togglePin}
              className={cn(
                "h-10 w-full rounded-lg flex items-center gap-3 px-2 transition-colors",
                isAppBuilderRoute ? "text-white/72 hover:bg-white/5" : "hover:bg-sidebar-accent text-sidebar-foreground",
              )}
            >
              {pinned ? <PanelLeftClose className="w-[18px] h-[18px] shrink-0" /> : <PanelLeft className="w-[18px] h-[18px] shrink-0" />}
              <span className={cn("text-sm overflow-hidden transition-opacity duration-200", pinned ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100")}>
                {pinned ? "Collapse" : "Pin open"}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs group-hover/sidebar:hidden">
            {pinned ? "Collapse" : "Pin open"}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}



