import { useAgentSuggestions, useAllAgentSuggestions } from "@/hooks/useAgentSuggestions";
import { AgentSuggestionCard } from "./AgentSuggestionCard";
import { GroupedSuggestionCard } from "./GroupedSuggestionCard";
import { Sparkles, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentSuggestion } from "@/hooks/useAgentSuggestions";

interface AgentSuggestionsPanelProps {
  agentCode: string;
  agentName: string;
  isSuperAdmin?: boolean;
}

function groupByCustomer(suggestions: (AgentSuggestion & { agent_name?: string })[]) {
  const groups = new Map<string, (AgentSuggestion & { agent_name?: string })[]>();
  for (const s of suggestions) {
    const match = s.title.match(/^(.+?)\s*[—–\-]\s*(?:\$|Invoice|Inv)/i);
    const key = match?.[1]?.trim() ?? s.title;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}

export function AgentSuggestionsPanel({ agentCode, agentName, isSuperAdmin = false }: AgentSuggestionsPanelProps) {
  const singleAgent = useAgentSuggestions(agentCode);
  const allAgents = useAllAgentSuggestions();

  const source = isSuperAdmin ? allAgents : singleAgent;
  const { suggestions, isLoading, actOnSuggestion, dismissSuggestion, snoozeSuggestion } = source;

  if (isLoading || suggestions.length === 0) return null;

  const groups = groupByCustomer(suggestions);

  const handleDismissAll = () => {
    if (isSuperAdmin && 'bulkDismiss' in source) {
      (source as typeof allAgents).bulkDismiss.mutate(suggestions.map((s) => s.id));
    } else {
      suggestions.forEach((s) => dismissSuggestion.mutate(s.id));
    }
  };

  const handleSnoozeAll = () => {
    if (isSuperAdmin && 'bulkSnooze' in source) {
      (source as typeof allAgents).bulkSnooze.mutate(suggestions.map((s) => s.id));
    } else {
      suggestions.forEach((s) => snoozeSuggestion.mutate(s.id));
    }
  };

  const panelTitle = isSuperAdmin ? "All Agent Suggestions" : `${agentName} Suggestions`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{panelTitle}</h3>
          <span className="text-xs text-muted-foreground">({suggestions.length})</span>
        </div>
        {suggestions.length > 5 && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleSnoozeAll}>
              <Clock className="w-3 h-3" /> Snooze All
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleDismissAll}>
              <XCircle className="w-3 h-3" /> Dismiss All
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from(groups.entries()).map(([customerName, items]) =>
          items.length >= 2 ? (
            <GroupedSuggestionCard
              key={customerName}
              customerName={customerName}
              suggestions={items}
              agentName={(items[0] as any).agent_name ?? agentName}
              onAct={(id) => actOnSuggestion.mutate({ id, actionType: "act" })}
              onSnooze={(id) => snoozeSuggestion.mutate(id)}
              onDismiss={(id) => dismissSuggestion.mutate(id)}
            />
          ) : (
            items.map((s) => (
              <AgentSuggestionCard
                key={s.id}
                suggestion={s}
                agentName={(s as any).agent_name ?? agentName}
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
