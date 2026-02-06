import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Calculator, 
  HeadphonesIcon, 
  Receipt, 
  Ruler 
} from "lucide-react";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation";

interface Agent {
  id: AgentType;
  name: string;
  icon: React.ElementType;
  description: string;
}

const agents: Agent[] = [
  { id: "sales", name: "Sales", icon: TrendingUp, description: "Quotes & orders" },
  { id: "accounting", name: "Accounting", icon: Calculator, description: "QB sync & invoices" },
  { id: "support", name: "Support", icon: HeadphonesIcon, description: "Customer issues" },
  { id: "collections", name: "Collections", icon: Receipt, description: "AR & payments" },
  { id: "estimation", name: "Estimation", icon: Ruler, description: "Job costing" },
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
