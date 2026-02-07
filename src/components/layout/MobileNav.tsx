import { Link, useLocation } from "react-router-dom";
import { Home, Inbox, CheckSquare, Kanban, Phone, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Brain, Settings, Plug, Factory, Truck, Users, Shield } from "lucide-react";

const primaryNav = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Calls", href: "/phonecalls", icon: Phone },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "More", href: "#more", icon: Menu },
];

const moreItems = [
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Shop Floor", href: "/shop-floor", icon: Factory },
  { name: "Deliveries", href: "/deliveries", icon: Truck },
  { name: "Brain", href: "/brain", icon: Brain },
  { name: "Integrations", href: "/integrations", icon: Plug },
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreItems.some((item) => location.pathname === item.href);

  return (
    <>
      {/* More menu overlay */}
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
              {moreItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
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

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {primaryNav.map((item) => {
            const isMore = item.href === "#more";
            const isActive = isMore ? isMoreActive || showMore : location.pathname === item.href;

            if (isMore) {
              return (
                <button
                  key={item.name}
                  onClick={() => setShowMore(!showMore)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-1 px-3 transition-colors",
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
                  "flex flex-col items-center gap-1 py-1 px-3 transition-colors",
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
}
