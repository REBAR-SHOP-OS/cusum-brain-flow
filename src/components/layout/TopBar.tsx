import { useState } from "react";
import { Search, Sparkles, Warehouse, ChevronDown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";
import { CommandBar } from "./CommandBar";
import brandLogo from "@/assets/brand-logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const warehouses = [
  { id: "main", label: "Main Yard" },
  { id: "yard-b", label: "Yard B" },
  { id: "offsite", label: "Off-site Storage" },
];

export function TopBar() {
  const { warehouse, setWarehouse, toggleIntelligencePanel, intelligencePanelOpen } = useWorkspace();
  const { isAdmin, isOffice } = useUserRole();
  const { isSuperAdmin } = useSuperAdmin();
  const [commandOpen, setCommandOpen] = useState(false);
  const currentWarehouse = warehouses.find((w) => w.id === warehouse) ?? warehouses[0];

  return (
    <>
      <header className="h-12 shrink-0 border-b border-border bg-card flex items-center gap-2 px-3 z-30">
        {/* Logo */}
        <img src={brandLogo} alt="RSOS" className="w-7 h-7 rounded-full object-contain" />
        <span className="text-xs font-bold tracking-wider text-foreground uppercase hidden sm:block mr-2">
          REBAR OS
        </span>

        {/* Warehouse Selector */}
        {(isAdmin || isOffice) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
                <Warehouse className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{currentWarehouse.label}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {warehouses.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onClick={() => setWarehouse(w.id)}
                  className={warehouse === w.id ? "bg-accent" : ""}
                >
                  {w.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Command bar trigger */}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-2 text-xs text-muted-foreground h-8 w-48 md:w-64 justify-start"
          onClick={() => setCommandOpen(true)}
          data-tour="topbar-search"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search or command…</span>
          <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded hidden md:inline">⌘K</kbd>
        </Button>

        {/* Admin Console Toggle - Super Admin only */}
        {isSuperAdmin && (
          <Button
            variant={intelligencePanelOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={toggleIntelligencePanel}
            title="Admin Console"
          >
            <Wrench className="w-4 h-4" />
          </Button>
        )}

        <ThemeToggle />
        <div data-tour="topbar-user">
          <UserMenu />
        </div>
      </header>

      <CommandBar open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
