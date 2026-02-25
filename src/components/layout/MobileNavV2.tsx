// forwardRef cache bust
import { Link, useLocation } from "react-router-dom";
import { Home, Inbox, CheckSquare, Factory, Menu, X, Truck, Settings, Shield, Phone, Users, Kanban, LayoutGrid, Brain, DollarSign, MessageSquare, BarChart3, Clock, Share2, FileText, Bot, Globe, Search, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";

const primaryNav = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Driver", href: "/driver", icon: Truck },
  { name: "More", href: "#more", icon: Menu },
];

const moreItems = [
  { name: "Pipeline", href: "/pipeline", icon: Kanban, roles: ["admin", "sales", "office", "shop_supervisor"] },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Office", href: "/office", icon: LayoutGrid, roles: ["admin", "office"] },
  { name: "Accounting", href: "/accounting", icon: DollarSign, roles: ["admin", "accounting", "office"] },
  { name: "CEO Portal", href: "/ceo", icon: BarChart3, roles: ["admin"] },
  { name: "Deliveries", href: "/deliveries", icon: Truck },
  { name: "Calls", href: "/phonecalls", icon: Phone },
  { name: "Team Hub", href: "/team-hub", icon: MessageSquare },
  { name: "Time Clock", href: "/timeclock", icon: Clock },
  { name: "Social", href: "/social", icon: Share2, roles: ["admin", "office"] },
  { name: "Support", href: "/support-inbox", icon: Headset, roles: ["admin", "office"] },
  { name: "Summarizer", href: "/daily-summarizer", icon: FileText, roles: ["admin", "sales", "office"] },
  { name: "Admin", href: "/admin", icon: Shield, roles: ["admin"] },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const MobileNavV2 = React.forwardRef<HTMLElement, {}>(function MobileNavV2(_props, ref) {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { roles, isAdmin, isCustomer } = useUserRole();
  const { user } = useAuth();
  const email = user?.email || "";
  const isInternal = email.endsWith("@rebar.shop");
  const { hasAccess: isLinkedCustomer } = useCustomerPortalData();
  const isExternalEmployee = !isInternal && !!email && !isLinkedCustomer;

  // Hide mobile nav on full-screen chat route
  if (location.pathname === "/chat") return null;

  // Customer role gets portal-only nav
  if (isCustomer && roles.length === 1) {
    const custNav = [
      { name: "Portal", href: "/portal", icon: Users },
    ];
    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {custNav.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // External employees get role-aware nav
  if (isExternalEmployee) {
    const hasOfficeRole = roles.includes("office" as any);
    const hasSupRole = roles.includes("shop_supervisor" as any);

    let extNav: { name: string; href: string; icon: React.ElementType }[];
    if (hasOfficeRole) {
      extNav = [
        { name: "Pipeline", href: "/pipeline", icon: Kanban },
        { name: "Clock", href: "/timeclock", icon: Clock },
        { name: "Team", href: "/team-hub", icon: MessageSquare },
      ];
    } else if (hasSupRole) {
      extNav = [
        { name: "Home", href: "/home", icon: Home },
        { name: "Floor", href: "/shop-floor", icon: Factory },
        { name: "Clock", href: "/timeclock", icon: Clock },
        { name: "Team", href: "/team-hub", icon: MessageSquare },
      ];
    } else {
      extNav = [
        { name: "Clock", href: "/timeclock", icon: Clock },
        { name: "Team", href: "/team-hub", icon: MessageSquare },
      ];
    }
    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {extNav.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  const isMoreActive = moreItems.some((item) => location.pathname === item.href);

  const isVisible = (item: { roles?: string[] }) => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.some((r) => roles.includes(r as any));
  };

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">More</h3>
              <button onClick={() => setShowMore(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreItems.filter(isVisible).map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {primaryNav.map((item) => {
            const isMore = item.href === "#more";
            const isActive = isMore ? isMoreActive || showMore : location.pathname === item.href;

            if (isMore) {
              return (
                <button
                  key={item.name}
                  onClick={() => setShowMore(!showMore)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {showMore ? <X className="w-5 h-5" /> : <item.icon className="w-5 h-5" />}
                  <span className="text-[10px] font-medium">{showMore ? "Close" : item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setShowMore(false)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
});
MobileNavV2.displayName = "MobileNavV2";
