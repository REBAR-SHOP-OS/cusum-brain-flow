import { useNavigate } from "react-router-dom";
import { LogOut, Settings, User, Warehouse, Wrench, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const warehouses = [
  { id: "main", label: "Main Yard" },
  { id: "yard-b", label: "Yard B" },
  { id: "offsite", label: "Off-site Storage" },
];

function getInitials(email: string | undefined): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { warehouse, setWarehouse, toggleIntelligencePanel } = useWorkspace();
  const { isAdmin, isOffice } = useUserRole();
  const { isSuperAdmin } = useSuperAdmin();

  if (!user) return null;

  const initials = getInitials(user.email);
  const currentWarehouse = warehouses.find((w) => w.id === warehouse) ?? warehouses[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-white/30 transition-all">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-white/20 text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* User info */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.email?.split("@")[0]}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Preferences (theme) */}
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="w-4 h-4 mr-2" />
          Preferences
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <User className="w-4 h-4 mr-2" />
          My Profile
        </DropdownMenuItem>

        {/* Theme sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center gap-2 text-sm">
              🎨 Theme
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <div className="p-2">
              <ThemeToggle variant="full" />
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Warehouse selector (admin/office only) */}
        {(isAdmin || isOffice) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Warehouse className="w-4 h-4 mr-2" />
                <span>{currentWarehouse.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {warehouses.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    onClick={() => setWarehouse(w.id)}
                    className={warehouse === w.id ? "bg-accent" : ""}
                  >
                    {w.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {/* Admin Console (super admin only) */}
        {isSuperAdmin && (
          <DropdownMenuItem onClick={toggleIntelligencePanel}>
            <Wrench className="w-4 h-4 mr-2" />
            Admin Console
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={signOut} className="text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
