import { Monitor, TrendingUp, Users, DollarSign, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selectedPage: number;
  onSelectPage: (i: number) => void;
  pageNames: string[];
}

const MOCK_PAGES = ["Dashboard", "Customers", "Leads", "Projects", "Invoices"];

function MockDashboard() {
  const stats = [
    { label: "Revenue", value: "$124,500", icon: DollarSign, change: "+12%" },
    { label: "Customers", value: "342", icon: Users, change: "+8%" },
    { label: "Active Jobs", value: "28", icon: Briefcase, change: "+3" },
    { label: "Pipeline", value: "$89,200", icon: TrendingUp, change: "+18%" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-1">
              <s.icon className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[10px] text-emerald-400">{s.change}</span>
            </div>
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-white/50">{s.label}</p>
          </div>
        ))}
      </div>
      {/* Mini chart placeholder */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-3 h-28 flex items-end justify-between gap-1">
        {[40, 60, 35, 80, 55, 90, 70, 85, 65, 95, 75, 88].map((h, i) => (
          <div key={i} className="flex-1 bg-gradient-to-t from-orange-500/60 to-amber-400/40 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function MockTable() {
  const rows = [
    { name: "Acme Construction", status: "Active", value: "$12,500" },
    { name: "Smith Renovations", status: "Lead", value: "$8,200" },
    { name: "Harbor Electric", status: "Active", value: "$22,000" },
    { name: "Metro Plumbing", status: "Won", value: "$5,800" },
  ];

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] text-white/40 border-b border-white/10">
        <span>Name</span><span>Status</span><span>Value</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-3 gap-2 px-3 py-2 text-xs text-white/70 border-b border-white/5 last:border-0">
          <span className="text-white truncate">{r.name}</span>
          <span className={r.status === "Active" ? "text-emerald-400" : r.status === "Won" ? "text-blue-400" : "text-amber-400"}>{r.status}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function MockKanban() {
  const cols = [
    { title: "New", items: ["Website Redesign", "HVAC Install"] },
    { title: "Qualified", items: ["Office Remodel"] },
    { title: "Proposal", items: ["Kitchen Reno", "Deck Build"] },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto">
      {cols.map((c) => (
        <div key={c.title} className="flex-1 min-w-[100px]">
          <div className="text-[10px] text-white/50 font-medium mb-2 uppercase">{c.title}</div>
          <div className="space-y-1.5">
            {c.items.map((item) => (
              <div key={item} className="rounded-lg bg-white/5 border border-white/10 p-2 text-xs text-white/80">{item}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const PAGE_CONTENT = [MockDashboard, MockTable, MockKanban, MockTable, MockTable];

export function AppBuilderPreviewPanel({ selectedPage, onSelectPage, pageNames }: Props) {
  const names = pageNames.length > 0 ? pageNames : MOCK_PAGES;
  const Content = PAGE_CONTENT[selectedPage % PAGE_CONTENT.length];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Monitor className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-medium text-foreground">Preview</span>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {names.map((name, i) => (
          <button
            key={name}
            onClick={() => onSelectPage(i)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              selectedPage === i
                ? "bg-orange-500/20 text-orange-400"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Device frame */}
      <div className="flex-1 rounded-xl border border-border bg-[hsl(222,47%,6%)] p-4 overflow-auto">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-400/60" />
          <div className="w-2 h-2 rounded-full bg-amber-400/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
          <div className="flex-1 bg-white/5 rounded-full h-4 mx-2" />
        </div>
        <Content />
      </div>
    </div>
  );
}
