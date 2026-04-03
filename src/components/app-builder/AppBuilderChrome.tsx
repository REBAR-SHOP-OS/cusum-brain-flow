import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Boxes,
  BriefcaseBusiness,
  CircleHelp,
  CreditCard,
  Headphones,
  Home,
  LayoutGrid,
  MessageSquare,
  Monitor,
  Package2,
  Search,
  Settings,
  ShoppingBag,
  Signal,
  SquareCheckBig,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const primaryNav = [
  { icon: Home, label: "Home", href: "/home", active: true },
  { icon: ShoppingBag, label: "Projects", href: "/app-builder" },
  { icon: MessageSquare, label: "Messages", href: "/chat" },
  { icon: SquareCheckBig, label: "Tasks", href: "/tasks" },
  { icon: Monitor, label: "Workspace", href: "/office" },
  { icon: Signal, label: "Analytics", href: "/ceo" },
  { icon: Headphones, label: "Support", href: "/support-inbox" },
  { icon: CreditCard, label: "Billing", href: "/accounting" },
  { icon: BriefcaseBusiness, label: "Sales", href: "/sales" },
];

const utilityNav = [
  { icon: Boxes, label: "Apps", href: "/home" },
  { icon: Package2, label: "Inventory", href: "/shop-floor" },
];

function getInitials(email?: string | null) {
  if (!email) return "SA";
  const base = email.split("@")[0];
  const parts = base.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function AppBuilderSidebarRail() {
  const navigate = useNavigate();

  return (
    <aside className="app-builder-sidebar hidden md:flex">
      <button
        type="button"
        aria-label="Dashboard home"
        className="app-builder-sidebar__brand"
        onClick={() => navigate("/app-builder")}
      >
        <LayoutGrid className="h-[17px] w-[17px]" />
      </button>

      <div className="app-builder-sidebar__group">
        {primaryNav.map(({ icon: Icon, label, href, active }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            className={cn("app-builder-sidebar__icon", active && "is-active")}
            onClick={() => navigate(href)}
          >
            <Icon className="h-[17px] w-[17px]" />
          </button>
        ))}
      </div>

      <div className="app-builder-sidebar__spacer" />

      <div className="app-builder-sidebar__group app-builder-sidebar__group--bottom">
        {utilityNav.map(({ icon: Icon, label, href }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            className="app-builder-sidebar__icon"
            onClick={() => navigate(href)}
          >
            <Icon className="h-[17px] w-[17px]" />
          </button>
        ))}

        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          className="app-builder-sidebar__icon"
          onClick={() => navigate("/settings")}
        >
          <Settings className="h-[17px] w-[17px]" />
        </button>
      </div>
    </aside>
  );
}

function AppBuilderHeader() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <header className="app-builder-header">
      <div className="app-builder-header__title">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Dashboard</span>
      </div>

      <div className="app-builder-header__actions">
        <button type="button" className="app-builder-search" aria-label="Search">
          <Search className="h-4 w-4 opacity-70" />
          <span>Search...</span>
        </button>

        <button type="button" className="app-builder-header__icon" aria-label="Help">
          <CircleHelp className="h-[17px] w-[17px]" />
        </button>

        <button type="button" className="app-builder-header__icon" aria-label="Apps">
          <LayoutGrid className="h-[17px] w-[17px]" />
        </button>

        <button type="button" className="app-builder-header__icon app-builder-header__icon--notification" aria-label="Notifications">
          <Bell className="h-[17px] w-[17px]" />
          <span className="app-builder-header__badge">{unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : "5+"}</span>
        </button>

        <Avatar className="h-8 w-8 ring-1 ring-slate-950/20">
          <AvatarFallback className="bg-[#d7edf0] text-[11px] font-semibold text-[#10253b]">
            {getInitials(user?.email)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

function FloatingActionButtons() {
  return (
    <>
      <button type="button" aria-label="Open support chat" className="app-builder-fab app-builder-fab--chat">
        <MessageSquare className="h-[19px] w-[19px]" />
      </button>

      <button type="button" aria-label="Open camera help" className="app-builder-fab app-builder-fab--camera">
        <Search className="h-[19px] w-[19px]" />
      </button>
    </>
  );
}

export function AppBuilderChrome({ children }: { children: ReactNode }) {
  return (
    <div className="app-builder-theme">
      <div className="app-builder-shell">
        <AppBuilderSidebarRail />

        <div className="app-builder-main">
          <AppBuilderHeader />

          <main className="app-builder-content">
            <div className="app-builder-content__inner">{children}</div>
          </main>
        </div>
      </div>

      <FloatingActionButtons />
    </div>
  );
}
