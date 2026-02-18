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
  pendingCount?: number;
}

type MenuItem = { label: string; tab: string } | { type: "separator" } | { type: "label"; label: string };
type Menu = { label: string; tab?: string; items?: MenuItem[] };

const menus: Menu[] = [
  { label: "Dashboard", tab: "dashboard" },
  { label: "AI Actions", tab: "actions" },
  {
    label: "Customers",
    items: [
      { label: "Invoices", tab: "invoices" },
      { label: "Payments", tab: "payments" },
      { label: "Customers", tab: "customers" },
      { type: "separator" },
      { type: "label", label: "Orders & Documents" },
      { label: "Orders", tab: "orders" },
      { label: "Invoices / Packing Slips", tab: "documents" },
      { label: "Quotations / Estimates", tab: "documents" },
      { label: "Quotation Templates", tab: "quote-templates" },
      { type: "separator" },
      { type: "label", label: "Expense Management" },
      { label: "Expense Claims", tab: "expense-claims" },
    ],
  },
  {
    label: "Vendors",
    items: [
      { label: "Vendors", tab: "vendors" },
      { label: "Bills", tab: "bills" },
      { label: "Vendor Payments", tab: "vendor-payments" },
      { type: "separator" },
      { type: "label", label: "Procurement" },
      { label: "3-Way Matching", tab: "three-way-matching" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { label: "Chart of Accounts", tab: "accounts" },
      { label: "Budget Management", tab: "budgets" },
      { label: "AI Audit", tab: "audit" },
      { type: "separator" },
      { label: "Payroll Corrections", tab: "payroll" },
      { label: "Payroll Audit", tab: "payroll-audit" },
      { type: "separator" },
      { type: "label", label: "HR" },
      { label: "Employee Contracts & Certs", tab: "employee-contracts" },
      { label: "Recruitment Pipeline", tab: "recruitment" },
      { type: "separator" },
      { type: "label", label: "Projects" },
      { label: "Project Management", tab: "project-management" },
    ],
  },
  {
    label: "Reporting",
    items: [
      { type: "label", label: "Statement Reports" },
      { label: "Balance Sheet", tab: "balance-sheet" },
      { label: "Profit and Loss", tab: "profit-loss" },
      { label: "Cash Flow Statement", tab: "cash-flow" },
      { type: "separator" },
      { type: "label", label: "Aging Reports" },
      { label: "Aged Receivables", tab: "aged-receivables" },
      { label: "Aged Payables", tab: "aged-payables" },
      { type: "separator" },
      { type: "label", label: "Detail Reports" },
      { label: "General Ledger", tab: "general-ledger" },
      { label: "Trial Balance", tab: "trial-balance" },
      { label: "Transaction List by Date", tab: "transaction-list" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { type: "label", label: "Accounting" },
      { label: "Chart of Accounts", tab: "accounts" },
      { type: "separator" },
      { type: "label", label: "Payroll" },
      { label: "Payroll Corrections", tab: "payroll" },
      { label: "Payroll Audit", tab: "payroll-audit" },
    ],
  },
];

export function AccountingNavMenus({ activeTab, onNavigate, pendingCount = 0 }: AccountingNavProps) {
  return (
    <nav className="flex items-center gap-0.5">
      {menus.map((menu) => {
        if (!menu.items) {
          // Direct link (Dashboard, AI Actions)
          const isActive = activeTab === menu.tab;
          const showBadge = menu.tab === "actions" && pendingCount > 0;
          return (
            <Button
              key={menu.label}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="text-xs font-medium h-8 px-3 relative"
              onClick={() => onNavigate(menu.tab!)}
            >
              {menu.label}
              {showBadge && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
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
                if ("type" in item && item.type === "label") {
                  return (
                    <DropdownMenuLabel key={`lbl-${idx}`} className="text-[10px] tracking-widest text-muted-foreground uppercase pt-2">
                      {item.label}
                    </DropdownMenuLabel>
                  );
                }
                if ("tab" in item) {
                  return (
                    <DropdownMenuItem
                      key={`${item.tab}-${idx}`}
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
