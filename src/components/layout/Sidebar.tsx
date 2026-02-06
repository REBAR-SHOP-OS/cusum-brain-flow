import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Inbox, Brain, Settings, Plug, MessageSquare, CheckSquare, Factory, Truck, Users, Kanban, History, Bell, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { InboxPanel } from "@/components/panels/InboxPanel";
import { HistoryPanel } from "@/components/panels/HistoryPanel";

const navigation = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Inbox", href: "/", icon: Inbox },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Shop Floor", href: "/shop-floor", icon: Factory },
  { name: "Deliveries", href: "/deliveries", icon: Truck },
  { name: "Brain", href: "/brain", icon: Brain },
  { name: "Integrations", href: "/integrations", icon: Plug },
];

const bottomNav = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const [inboxPanelOpen, setInboxPanelOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  const handlePanelToggle = (panel: "inbox" | "history") => {
    if (panel === "inbox") {
      setInboxPanelOpen(!inboxPanelOpen);
      setHistoryPanelOpen(false);
    } else {
      setHistoryPanelOpen(!historyPanelOpen);
      setInboxPanelOpen(false);
    }
  };

  return (
    <>
      <aside className="flex flex-col w-16 bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>

        {/* Panel Toggles */}
        <div className="flex flex-col items-center py-2 gap-1 border-b border-sidebar-border">
          <button
            onClick={() => handlePanelToggle("inbox")}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative",
              "hover:bg-sidebar-accent",
              inboxPanelOpen
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            )}
            title="Inbox"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              8
            </span>
          </button>
          <button
            onClick={() => handlePanelToggle("history")}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              "hover:bg-sidebar-accent",
              historyPanelOpen
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            )}
            title="History"
          >
            <History className="w-5 h-5" />
          </button>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 flex flex-col items-center py-4 gap-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  "hover:bg-sidebar-accent",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
                )}
                title={item.name}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        {/* Bottom Nav */}
        <div className="flex flex-col items-center py-4 gap-2 border-t border-sidebar-border">
          {bottomNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  "hover:bg-sidebar-accent",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
                )}
                title={item.name}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            );
          })}
          
          {/* User Menu */}
          <UserMenu />
        </div>
      </aside>

      {/* Slide-out Panels */}
      <InboxPanel isOpen={inboxPanelOpen} onClose={() => setInboxPanelOpen(false)} />
      <HistoryPanel isOpen={historyPanelOpen} onClose={() => setHistoryPanelOpen(false)} />
    </>
  );
}
