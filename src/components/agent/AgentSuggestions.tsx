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
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 sm:gap-3 px-0 sm:px-4 pb-4 max-w-3xl mx-auto w-full">
      {suggestions.map((s) => (
        <Card
          key={s.title}
          onClick={() => onSelect(s.title)}
          className="flex flex-col justify-between p-3 sm:p-4 sm:w-[200px] cursor-pointer hover:bg-muted/50 transition-colors group"
        >
          <p className="text-xs sm:text-sm font-medium mb-3 sm:mb-4 leading-snug line-clamp-3">{s.title}</p>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
            <img src={agentImage} alt={agentName} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover" />
            <span className="truncate">{s.category}</span>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 ml-auto shrink-0 group-hover:text-foreground transition-colors" />
          </div>
        </Card>
      ))}
    </div>
  );
}
