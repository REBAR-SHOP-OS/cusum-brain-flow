import {
  LayoutDashboard, FileText, CreditCard, Users, Store, Receipt,
  Landmark, ArrowLeftRight, BookOpen, BarChart3, ClipboardList,
  Bot, Shield, Layers, Clock, Paperclip, Calendar, Calculator,
  Briefcase, UserPlus, FolderKanban, FileCheck, DollarSign,
  TrendingUp, PieChart, Scale, FileSpreadsheet, Banknote,
  ShoppingCart, RotateCcw, Wallet, BadgeDollarSign,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface AccountingSidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  pendingCount?: number;
}

interface NavItem {
  label: string;
  tab: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Sales",
    items: [
      { label: "Estimates", tab: "documents", icon: FileCheck },
      { label: "Invoices", tab: "invoices", icon: FileText },
      { label: "Payments Received", tab: "payments", icon: CreditCard },
      { label: "Credit Memos", tab: "credit-memos", icon: RotateCcw },
      { label: "Sales Receipts", tab: "sales-receipts", icon: Receipt },
      { label: "Refund Receipts", tab: "refund-receipts", icon: BadgeDollarSign },
      { label: "Customers", tab: "customers", icon: Users },
    ],
  },
  {
    label: "Purchases",
    items: [
      { label: "Bills", tab: "bills", icon: FileSpreadsheet },
      { label: "Vendor Payments", tab: "vendor-payments", icon: Banknote },
      { label: "Vendors", tab: "vendors", icon: Store },
      { label: "Expenses", tab: "expenses", icon: Wallet },
      { label: "Purchase Orders", tab: "orders", icon: ShoppingCart },
      { label: "3-Way Matching", tab: "three-way-matching", icon: ClipboardList },
      { label: "Expense Claims", tab: "expense-claims", icon: DollarSign },
    ],
  },
  {
    label: "Banking",
    items: [
      { label: "Chart of Accounts", tab: "accounts", icon: Landmark },
      { label: "Reconciliation", tab: "reconciliation", icon: Scale },
      { label: "Deposits", tab: "deposits", icon: Banknote },
      { label: "Transfers", tab: "transfers", icon: ArrowLeftRight },
      { label: "Journal Entries", tab: "journal-entries", icon: BookOpen },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Balance Sheet", tab: "balance-sheet", icon: BarChart3 },
      { label: "Profit & Loss", tab: "profit-loss", icon: TrendingUp },
      { label: "Cash Flow", tab: "cash-flow", icon: PieChart },
      { label: "Cash Flow (QB)", tab: "cash-flow-report", icon: PieChart },
      { label: "Aged Receivables", tab: "aged-receivables", icon: FileText },
      { label: "Aged Payables", tab: "aged-payables", icon: FileText },
      { label: "Trial Balance", tab: "trial-balance", icon: Scale },
      { label: "General Ledger", tab: "general-ledger", icon: BookOpen },
      { label: "Tax Summary", tab: "tax-filing", icon: Calculator },
      { label: "Statements", tab: "statements", icon: FileText },
      { label: "Budget vs Actuals", tab: "budget-vs-actuals", icon: BarChart3 },
      { label: "Transaction List", tab: "transaction-list", icon: ClipboardList },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "AI Actions", tab: "actions", icon: Bot },
      { label: "AI Audit", tab: "audit", icon: Shield },
      { label: "Batch Actions", tab: "batch-actions", icon: Layers },
      { label: "Recurring Txns", tab: "recurring", icon: Clock },
      { label: "Recurring Auto", tab: "recurring-auto", icon: Clock },
      { label: "Attachments", tab: "attachments", icon: Paperclip },
      { label: "Scheduled Reports", tab: "scheduled-reports", icon: Calendar },
      { label: "Tax Planning", tab: "tax-planning", icon: Calculator },
      { label: "Budget Mgmt", tab: "budgets", icon: BarChart3 },
      { label: "Quote Templates", tab: "quote-templates", icon: FileCheck },
    ],
  },
  {
    label: "HR & Projects",
    items: [
      { label: "Payroll Corrections", tab: "payroll", icon: Briefcase },
      { label: "Payroll Audit", tab: "payroll-audit", icon: Shield },
      { label: "Employee Contracts", tab: "employee-contracts", icon: FileText },
      { label: "Recruitment", tab: "recruitment", icon: UserPlus },
      { label: "Projects", tab: "project-management", icon: FolderKanban },
    ],
  },
];

export function AccountingSidebar({ activeTab, onNavigate, pendingCount = 0 }: AccountingSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="px-3 py-3">
        {!isCollapsed && (
          <span className="text-sm font-bold tracking-tight">💰 Accounting</span>
        )}
      </SidebarHeader>
      <SidebarContent>
        {/* Dashboard (top-level) */}
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "dashboard"}
                  onClick={() => onNavigate("dashboard")}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard className="shrink-0" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const showBadge = item.tab === "actions" && pendingCount > 0;
                  return (
                    <SidebarMenuItem key={item.tab + item.label}>
                      <SidebarMenuButton
                        isActive={activeTab === item.tab}
                        onClick={() => onNavigate(item.tab)}
                        tooltip={item.label}
                      >
                        <item.icon className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1 text-[10px]">
                            {pendingCount > 9 ? "9+" : pendingCount}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
