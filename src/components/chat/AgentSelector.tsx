import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Calculator, 
  HeadphonesIcon, 
  Receipt, 
  Ruler,
  Share2,
  Scale,
  LayoutGrid,
  Crown
} from "lucide-react";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation" | "social" | "eisenhower" | "legal" | "commander";

interface Agent {
  id: AgentType;
  name: string;
  icon: React.ElementType;
  description: string;
}

const agents: Agent[] = [
  { id: "sales", name: "Blitz", icon: TrendingUp, description: "Sales & Orders" },
  { id: "accounting", name: "Penny", icon: Calculator, description: "Invoices & QB" },
  { id: "legal", name: "Tally", icon: Scale, description: "Legal & Compliance" },
  { id: "support", name: "Haven", icon: HeadphonesIcon, description: "Customer Care" },
  { id: "collections", name: "Chase", icon: Receipt, description: "AR & Payments" },
  { id: "estimation", name: "Cal", icon: Ruler, description: "Job Costing" },
  { id: "social", name: "Pixel", icon: Share2, description: "Social Media" },
  { id: "eisenhower", name: "Eisenhower Matrix", icon: LayoutGrid, description: "Priority Matrix" },
  { id: "commander", name: "Commander", icon: Crown, description: "Sales Manager" },
];

interface AgentSelectorProps {
  selected: AgentType;
  onSelect: (agent: AgentType) => void;
}

export function AgentSelector({ selected, onSelect }: AgentSelectorProps) {
  return (
    <div className="flex gap-2 p-3 border-b border-border overflow-x-auto scrollbar-thin">
      {agents.map((agent) => {
        const isSelected = selected === agent.id;
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap",
              "hover:bg-secondary",
              isSelected
                ? `agent-badge-${agent.id} border border-agent-${agent.id}/30`
                : "text-muted-foreground"
            )}
          >
            <agent.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{agent.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AgentBadge({ agent }: { agent: AgentType }) {
  const agentData = agents.find((a) => a.id === agent);
  if (!agentData) return null;

  return (
    <span className={cn("agent-badge", `agent-badge-${agent}`)}>
      <agentData.icon className="w-3 h-3" />
      {agentData.name}
    </span>
  );
}
