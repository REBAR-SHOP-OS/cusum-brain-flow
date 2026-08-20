import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CEODashboardV2 } from "@/components/dashboards/v2/CEODashboardV2";
import { GMDashboardV2 } from "@/components/dashboards/v2/GMDashboardV2";
import { SalesDashboardV2 } from "@/components/dashboards/v2/SalesDashboardV2";
import { MarketingDashboardV2 } from "@/components/dashboards/v2/MarketingDashboardV2";
import { EstimationDashboardV2 } from "@/components/dashboards/v2/EstimationDashboardV2";
import { ShopFloorDashboardV2 } from "@/components/dashboards/v2/ShopFloorDashboardV2";
import { AccountingDashboardV2 } from "@/components/dashboards/v2/AccountingDashboardV2";
import { RDDashboardV2 } from "@/components/dashboards/v2/RDDashboardV2";

type Role =
  | "ceo" | "gm" | "sales" | "marketing"
  | "estimation" | "shopfloor" | "accounting" | "rd";

const ROLES: { id: Role; label: string }[] = [
  { id: "ceo",        label: "CEO" },
  { id: "gm",         label: "General Manager" },
  { id: "sales",      label: "Sales" },
  { id: "marketing",  label: "Marketing" },
  { id: "estimation", label: "Estimation" },
  { id: "shopfloor",  label: "Shop Floor" },
  { id: "accounting", label: "Accounting" },
  { id: "rd",         label: "R&D" },
];

export default function DashboardV2() {
  const [role, setRole] = useState<Role>("ceo");
  const [open, setOpen] = useState(false);

  const switcher = (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-[hsl(var(--v2-border))] text-[hsl(var(--v2-text))] hover:bg-[hsl(var(--v2-panel-2))]"
      >
        {ROLES.find(r => r.id === role)?.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-48 rounded-md border border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-panel))] shadow-lg overflow-hidden">
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setOpen(false); }}
                className={`block w-full text-left text-xs px-3 py-2 hover:bg-[hsl(var(--v2-panel-2))] ${
                  r.id === role ? "text-[hsl(var(--v2-text))] bg-[hsl(var(--v2-panel-2))]" : "text-[hsl(var(--v2-text-muted))]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  switch (role) {
    case "ceo":        return <CEODashboardV2 roleSwitcher={switcher} />;
    case "gm":         return <GMDashboardV2 roleSwitcher={switcher} />;
    case "sales":      return <SalesDashboardV2 roleSwitcher={switcher} />;
    case "marketing":  return <MarketingDashboardV2 roleSwitcher={switcher} />;
    case "estimation": return <EstimationDashboardV2 roleSwitcher={switcher} />;
    case "shopfloor":  return <ShopFloorDashboardV2 roleSwitcher={switcher} />;
    case "accounting": return <AccountingDashboardV2 roleSwitcher={switcher} />;
    case "rd":         return <RDDashboardV2 roleSwitcher={switcher} />;
  }
}
