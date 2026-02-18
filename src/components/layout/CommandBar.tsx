import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home, Factory, Package, Truck, Users, Kanban, CheckSquare,
  LayoutGrid, FileText, Brain, Settings, Shield, Inbox, Phone,
  Sparkles, MessageSquare,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavCommand {
  label: string;
  icon: React.ElementType;
  href: string;
  roles?: string[];
  group: string;
}

const navCommands: NavCommand[] = [
  { label: "Dashboard", icon: Home, href: "/home", group: "Navigate" },
  { label: "Inbox", icon: Inbox, href: "/inbox", group: "Navigate" },
  { label: "Employee Tasks", icon: CheckSquare, href: "/tasks", group: "Navigate" },
  { label: "Pipeline", icon: Kanban, href: "/pipeline", roles: ["admin", "sales", "office"], group: "Navigate" },
  { label: "Customers", icon: Users, href: "/customers", group: "Navigate" },
  { label: "Shop Floor Hub", icon: Factory, href: "/shop-floor", group: "Operations" },
  { label: "Station Dashboard", icon: Factory, href: "/shopfloor/station", group: "Operations" },
  { label: "Office Portal", icon: LayoutGrid, href: "/office", roles: ["admin", "office"], group: "Operations" },
  { label: "Inventory", icon: Package, href: "/office", roles: ["admin", "office"], group: "Operations" },
  { label: "Deliveries", icon: Truck, href: "/deliveries", group: "Operations" },
  { label: "Brain / Knowledge", icon: Brain, href: "/brain", group: "System" },
  { label: "Phone Calls", icon: Phone, href: "/phonecalls", group: "System" },
  { label: "Admin Panel", icon: Shield, href: "/admin", roles: ["admin"], group: "System" },
  { label: "Settings", icon: Settings, href: "/settings", group: "System" },
];

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const navigate = useNavigate();
  const { roles, isAdmin } = useUserRole();

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const filteredCommands = navCommands.filter((cmd) => {
    if (!cmd.roles) return true;
    if (isAdmin) return true;
    return cmd.roles.some((r) => roles.includes(r as any));
  });

  const groups = Array.from(new Set(filteredCommands.map((c) => c.group)));

  const handleSelect = useCallback(
    (href: string) => {
      navigate(href);
      onOpenChange(false);
    },
    [navigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, commands, or ask the system…" />
      <CommandList>
        <CommandEmpty>No results found. Try asking differently.</CommandEmpty>
        {groups.map((group, i) => (
          <div key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {filteredCommands
                .filter((c) => c.group === group)
                .map((cmd) => (
                  <CommandItem
                    key={cmd.href + cmd.label}
                    onSelect={() => handleSelect(cmd.href)}
                    className="gap-2"
                  >
                    <cmd.icon className="w-4 h-4 text-muted-foreground" />
                    <span>{cmd.label}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
