import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountingNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

type MenuItem = { label: string; tab: string } | { type: "separator" };
type Menu = { label: string; tab?: string; items?: MenuItem[] };

const menus: Menu[] = [
  { label: "Dashboard", tab: "dashboard" },
  {
    label: "Customers",
    items: [
      { label: "Invoices", tab: "invoices" },
      { label: "Payments", tab: "payments" },
      { label: "Customers", tab: "customers" },
    ],
  },
  {
    label: "Vendors",
    items: [
      { label: "Bills", tab: "bills" },
      { label: "Payments", tab: "payments" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { label: "Accounts", tab: "accounts" },
      { label: "AI Audit", tab: "audit" },
      { type: "separator" },
      { label: "Payroll", tab: "payroll" },
    ],
  },
];

export function AccountingNavMenus({ activeTab, onNavigate }: AccountingNavProps) {
  return (
    <nav className="flex items-center gap-0.5">
      {menus.map((menu) => {
        if (!menu.items) {
          // Direct link (Dashboard)
          const isActive = activeTab === menu.tab;
          return (
            <Button
              key={menu.label}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="text-xs font-medium h-8 px-3"
              onClick={() => onNavigate(menu.tab!)}
            >
              {menu.label}
            </Button>
          );
        }

        const isActive = menu.items.some((i) => "tab" in i && i.tab === activeTab);
        return (
          <DropdownMenu key={menu.label}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className="text-xs font-medium h-8 px-3"
              >
                {menu.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              {menu.items.map((item, idx) => {
                if ("type" in item && item.type === "separator") {
                  return <DropdownMenuSeparator key={`sep-${idx}`} />;
                }
                if ("tab" in item) {
                  return (
                    <DropdownMenuItem
                      key={item.tab}
                      className="text-sm cursor-pointer"
                      onClick={() => onNavigate(item.tab)}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  );
                }
                return null;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
