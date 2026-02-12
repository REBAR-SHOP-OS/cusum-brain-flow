import { useAgentSuggestions } from "@/hooks/useAgentSuggestions";
import { AgentSuggestionCard } from "./AgentSuggestionCard";
import { Sparkles } from "lucide-react";

interface AgentSuggestionsPanelProps {
  agentCode: string;
  agentName: string;
}

export function AgentSuggestionsPanel({ agentCode, agentName }: AgentSuggestionsPanelProps) {
  const { suggestions, isLoading, actOnSuggestion, snoozeSuggestion, dismissSuggestion } = useAgentSuggestions(agentCode);

  if (isLoading || suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{agentName} Suggestions</h3>
        <span className="text-xs text-muted-foreground">({suggestions.length})</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {suggestions.map((s) => (
          <AgentSuggestionCard
            key={s.id}
            suggestion={s}
            agentName={agentName}
            onAct={(id) => actOnSuggestion.mutate({ id, actionType: "act" })}
            onSnooze={(id) => snoozeSuggestion.mutate(id)}
            onDismiss={(id) => dismissSuggestion.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}
