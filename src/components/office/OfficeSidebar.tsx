import { 
  FileText, 
  List, 
  ListOrdered, 
  Package, 
  Sparkles, 
  Tag, 
  FileBox, 
  DollarSign,
  Activity,
  Terminal,
  Users,
  LayoutGrid,
  ArrowLeft,
  Languages
} from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import brandLogo from "@/assets/brand-logo.png";

export type OfficeSection = 
  | "ceo-dashboard"
  | "ai-extract"
  | "ai-transcribe"
  | "detailed-list"
  | "production-queue"
  | "inventory"
  | "optimization"
  | "tags-export"
  | "packing-slips"
  | "payroll-audit"
  | "live-monitor"
  | "diagnostic-log"
  | "member-area";

interface OfficeSidebarProps {
  active: OfficeSection;
  onNavigate: (section: OfficeSection) => void;
}

const officeTools: { id: OfficeSection; label: string; icon: React.ElementType }[] = [
  { id: "ai-extract", label: "AI Extract", icon: FileText },
  
  { id: "detailed-list", label: "Detailed List", icon: List },
  { id: "production-queue", label: "Production Queue", icon: ListOrdered },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "optimization", label: "Optimization", icon: Sparkles },
  { id: "tags-export", label: "Tags & Export", icon: Tag },
  { id: "packing-slips", label: "Packing Slips", icon: FileBox },
  { id: "payroll-audit", label: "Payroll Audit", icon: DollarSign },
];

const bottomItems: { id: OfficeSection; label: string; icon: React.ElementType }[] = [
  { id: "live-monitor", label: "Live Monitor", icon: Activity },
  { id: "diagnostic-log", label: "Diagnostic Log", icon: Terminal },
  { id: "member-area", label: "Member Area", icon: Users },
];

export function OfficeSidebar({ active, onNavigate }: OfficeSidebarProps) {
  return (
    <aside className="w-[180px] shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-2">
        <img src={brandLogo} alt="Rebar.shop" className="w-7 h-7 rounded-full object-contain" />
        <span className="text-xs font-bold tracking-wider text-foreground uppercase">Office Tools</span>
      </div>

      <ScrollArea className="flex-1 px-2">
        {/* Office Tools Section */}
        <div className="mt-3 mb-1 px-3">
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
            Office Tools
          </span>
        </div>

        {officeTools.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              active === item.id
                ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}

        {/* Bottom items */}
        <div className="mt-6">
          {bottomItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer: Switch Mode */}
      <div className="border-t border-border p-3">
        <Link
          to="/shop-floor"
          className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Switch Mode
        </Link>
      </div>
    </aside>
  );
}
