import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Calculator, 
  HeadphonesIcon, 
  Share2,
  Scale,
  LayoutGrid,
} from "lucide-react";

export type AgentType = "sales" | "accounting" | "support" | "social" | "eisenhower" | "legal";

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
  { id: "social", name: "Pixel", icon: Share2, description: "Social Media" },
  { id: "eisenhower", name: "Eisenhower Matrix", icon: LayoutGrid, description: "Priority Matrix" },
];


export function AgentBadge({ agent }: { agent: string }) {
  const agentData = agents.find((a) => a.id === agent);
  if (!agentData) return null;

  return (
    <span className={cn("agent-badge", `agent-badge-${agent}`)}>
      <agentData.icon className="w-3 h-3" />
      {agentData.name}
    </span>
  );
}
