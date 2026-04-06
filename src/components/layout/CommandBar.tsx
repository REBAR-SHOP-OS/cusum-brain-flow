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
  LayoutGrid, FileText, Brain, Workflow, Settings, Shield, Inbox, Phone,
  Sparkles, MessageSquare, TrendingUp, Receipt,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavCommand {
  label: string;
  icon: React.ElementType;
  href: string;
  roles?: string[];
  blockedEmails?: string[];
  group: string;
}

const navCommands: NavCommand[] = [
  { label: "Dashboard", icon: Home, href: "/home", group: "Navigate" },
  
  { label: "Business Tasks", icon: CheckSquare, href: "/tasks", group: "Navigate" },
  { label: "Pipeline", icon: Kanban, href: "/pipeline", roles: ["admin", "sales", "office"], group: "Navigate" },
  { label: "Customers", icon: Users, href: "/customers", group: "Navigate", blockedEmails: ["zahra@rebar.shop"] },
  { label: "Shop Floor Hub", icon: Factory, href: "/shop-floor", group: "Operations", blockedEmails: ["zahra@rebar.shop"] },
  { label: "Station Dashboard", icon: Factory, href: "/shopfloor/station", group: "Operations", blockedEmails: ["zahra@rebar.shop"] },
  { label: "Office Portal", icon: LayoutGrid, href: "/office", roles: ["admin", "office"], group: "Operations" },
  { label: "Inventory", icon: Package, href: "/office", roles: ["admin", "office"], group: "Operations" },
  
  { label: "Brain / Knowledge", icon: Brain, href: "/brain", group: "System" },
  { label: "Phone Calls", icon: Phone, href: "/phonecalls", group: "System" },
  { label: "Admin Panel", icon: Shield, href: "/admin", roles: ["admin"], group: "System" },
  { label: "Architecture", icon: Workflow, href: "/architecture", group: "System" },
  { label: "Settings", icon: Settings, href: "/settings", group: "System" },
  { label: "Sales Department", icon: TrendingUp, href: "/sales", roles: ["admin", "sales", "office"], group: "Navigate" },
  { label: "Sales Pipeline", icon: Kanban, href: "/sales/pipeline", roles: ["admin", "sales", "office"], group: "Navigate" },
  { label: "Sales Quotations", icon: FileText, href: "/sales/quotations", roles: ["admin", "sales", "office"], group: "Navigate" },
  { label: "Sales Invoices", icon: Receipt, href: "/sales/invoices", roles: ["admin", "sales", "office"], group: "Navigate" },
  { label: "Sales Contacts", icon: Users, href: "/sales/contacts", roles: ["admin", "sales", "office"], group: "Navigate" },
];

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const navigate = useNavigate();
  const { roles, isAdmin } = useUserRole();
  const { user } = useAuth();
  const email = user?.email || "";

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
    if (cmd.blockedEmails?.includes(email.toLowerCase())) return false;
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
      <CommandInput placeholder="Search pages, commands, or ask the systemâ€¦" />
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


