import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Search, Bell, ChevronRight, HelpCircle, DatabaseBackup } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useActiveModule } from "@/hooks/useActiveModule";
import { useUserRole } from "@/hooks/useUserRole";
import { InboxPanel } from "@/components/panels/InboxPanel";
import { HelpPanel } from "@/components/help/HelpPanel";
import { BackupModal } from "@/components/backup/BackupModal";
import { UserMenu } from "./UserMenu";
import { CommandBar } from "./CommandBar";

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { module, breadcrumb } = useActiveModule();
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { isAdmin } = useUserRole();
  const isAppBuilderDashboard = location.pathname === "/app-builder";

  // Keep Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header
        className={`h-[46px] shrink-0 flex items-center px-3 z-30 ${
          isAppBuilderDashboard
            ? "bg-[hsl(var(--dashboard-reference-header))] text-[#072c2b] border-b border-black/10"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {/* Left: Grid icon */}
        <button
          onClick={() => navigate("/home")}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors mr-3 ${
            isAppBuilderDashboard ? "hover:bg-black/10" : "hover:bg-white/10"
          }`}
          title="Home"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {/* Module name + breadcrumb */}
        <nav className="flex items-center gap-1 text-[13px] min-w-0">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.href + crumb.label} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />}
              <button
                onClick={() => navigate(crumb.href)}
                className={`truncate hover:underline ${
                  i === 0 ? "font-semibold" : "opacity-80 font-normal"
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right group */}
        {/* Search (inline-styled, triggers CommandBar) */}
        <button
          onClick={() => setCommandOpen(true)}
          className={`flex items-center gap-2 h-[30px] px-3 rounded transition-colors text-[12px] w-48 md:w-56 mr-2 ${
            isAppBuilderDashboard
              ? "bg-white/20 text-[#0b4341] hover:bg-white/28 opacity-100"
              : "bg-white/10 hover:bg-white/20 opacity-80 hover:opacity-100"
          }`}
          data-tour="topbar-search"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="truncate">Search…</span>
        </button>

        {/* Help */}
        <button
          className={`relative w-8 h-8 flex items-center justify-center rounded transition-colors mr-1 ${
            isAppBuilderDashboard ? "hover:bg-black/10" : "hover:bg-white/10"
          }`}
          onClick={() => setHelpOpen((o) => !o)}
          title="Help & Training"
          aria-label="Help and training"
          data-tour="topbar-help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Backup & Restore — admin only */}
        {isAdmin && (
          <button
            className={`relative w-8 h-8 flex items-center justify-center rounded transition-colors mr-1 ${
              isAppBuilderDashboard ? "hover:bg-black/10" : "hover:bg-white/10"
            }`}
            onClick={() => setBackupOpen(true)}
            title="Backup & Restore"
            aria-label="Backup and restore"
          >
            <DatabaseBackup className="w-5 h-5" />
          </button>
        )}

        {/* Notifications */}
        <button
          className={`relative w-8 h-8 flex items-center justify-center rounded transition-colors mr-1 ${
            isAppBuilderDashboard ? "hover:bg-black/10" : "hover:bg-white/10"
          }`}
          onClick={() => setNotifOpen(true)}
          data-tour="topbar-notifications"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${
              isAppBuilderDashboard
                ? "bg-[#ff4b57] text-white"
                : "bg-destructive text-destructive-foreground"
            }`}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar dropdown */}
        <div data-tour="topbar-user">
          <UserMenu />
        </div>
      </header>

      <CommandBar open={commandOpen} onOpenChange={setCommandOpen} />
      <InboxPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <HelpPanel isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <BackupModal isOpen={backupOpen} onClose={() => setBackupOpen(false)} />
    </>
  );
}
