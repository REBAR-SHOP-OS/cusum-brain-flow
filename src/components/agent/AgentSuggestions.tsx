import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface AgentSuggestion {
  title: string;
  category: string;
}

interface AgentSuggestionsProps {
  suggestions: AgentSuggestion[];
  agentName: string;
  agentImage: string;
  onSelect: (suggestion: string) => void;
}

export function AgentSuggestions({ suggestions, agentName, agentImage, onSelect }: AgentSuggestionsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3 px-4 pb-4 max-w-3xl mx-auto">
      {suggestions.map((s) => (
        <Card
          key={s.title}
          onClick={() => onSelect(s.title)}
          className="flex flex-col justify-between p-4 w-[200px] cursor-pointer hover:bg-muted/50 transition-colors group"
        >
          <p className="text-sm font-medium mb-4 leading-snug">{s.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <img src={agentImage} alt={agentName} className="w-5 h-5 rounded-full object-cover" />
            <span>{s.category}</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto group-hover:text-foreground transition-colors" />
          </div>
        </Card>
      ))}
    </div>
  );
}
