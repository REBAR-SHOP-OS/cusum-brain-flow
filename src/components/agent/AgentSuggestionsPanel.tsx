import { useAgentSuggestions } from "@/hooks/useAgentSuggestions";
import { AgentSuggestionCard } from "./AgentSuggestionCard";
import { GroupedSuggestionCard } from "./GroupedSuggestionCard";
import { Sparkles } from "lucide-react";
import type { AgentSuggestion } from "@/hooks/useAgentSuggestions";

interface AgentSuggestionsPanelProps {
  agentCode: string;
  agentName: string;
}

function groupByCustomer(suggestions: AgentSuggestion[]) {
  const groups = new Map<string, AgentSuggestion[]>();
  for (const s of suggestions) {
    // Extract customer name before em-dash / en-dash / hyphen followed by space+$
    const match = s.title.match(/^(.+?)\s*[—–\-]\s*(?:\$|Invoice|Inv)/i);
    const key = match?.[1]?.trim() ?? s.title;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}

export function AgentSuggestionsPanel({ agentCode, agentName }: AgentSuggestionsPanelProps) {
  const { suggestions, isLoading, actOnSuggestion, snoozeSuggestion, dismissSuggestion } = useAgentSuggestions(agentCode);

  if (isLoading || suggestions.length === 0) return null;

  const groups = groupByCustomer(suggestions);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{agentName} Suggestions</h3>
        <span className="text-xs text-muted-foreground">({suggestions.length})</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from(groups.entries()).map(([customerName, items]) =>
          items.length >= 3 ? (
            <GroupedSuggestionCard
              key={customerName}
              customerName={customerName}
              suggestions={items}
              agentName={agentName}
              onAct={(id) => actOnSuggestion.mutate({ id, actionType: "act" })}
              onSnooze={(id) => snoozeSuggestion.mutate(id)}
              onDismiss={(id) => dismissSuggestion.mutate(id)}
            />
          ) : (
            items.map((s) => (
              <AgentSuggestionCard
                key={s.id}
                suggestion={s}
                agentName={agentName}
                onAct={(id) => actOnSuggestion.mutate({ id, actionType: "act" })}
                onSnooze={(id) => snoozeSuggestion.mutate(id)}
                onDismiss={(id) => dismissSuggestion.mutate(id)}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}
