import {
  Home, BarChart2, Globe, Search, Users, DollarSign,
  FileText, Boxes, Activity, Settings, Shield, HelpCircle,
} from "lucide-react";

const sidebarItems = [
  { icon: Home, label: "Home" },
  { icon: BarChart2, label: "Analytics" },
  { icon: Globe, label: "Web" },
  { icon: Search, label: "Search" },
  { icon: Users, label: "Team" },
  { icon: DollarSign, label: "Billing" },
  { icon: FileText, label: "Docs" },
  { icon: Boxes, label: "Apps" },
  { icon: Activity, label: "Health" },
  { icon: Settings, label: "Settings" },
  { icon: Shield, label: "Security" },
];

export function EmpireSidebar() {
  return (
    <aside className="w-[72px] shrink-0 border-r border-white/10 bg-black/30 backdrop-blur flex flex-col">
      <div className="flex h-14 items-center justify-center border-b border-white/10">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500" />
      </div>
      <nav className="flex flex-col items-center gap-2 py-4 flex-1">
        {sidebarItems.map((it, idx) => {
          const Icon = it.icon;
          return (
            <button
              key={idx}
              className="group flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 transition"
              title={it.label}
            >
              <Icon className="h-[18px] w-[18px] opacity-80 group-hover:opacity-100" />
            </button>
          );
        })}
      </nav>
      <div className="flex flex-col items-center gap-2 py-4">
        <button
          className="group flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 transition"
          title="Help"
        >
          <HelpCircle className="h-[18px] w-[18px] opacity-80 group-hover:opacity-100" />
        </button>
      </div>
    </aside>
  );
}
