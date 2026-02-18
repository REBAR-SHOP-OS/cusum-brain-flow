import React, { useState } from "react";
import { AlertTriangle, Info, ChevronDown, ChevronUp, Clock, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AgentSuggestionCard } from "./AgentSuggestionCard";
import type { AgentSuggestion } from "@/hooks/useAgentSuggestions";

interface GroupedSuggestionCardProps {
  customerName: string;
  suggestions: AgentSuggestion[];
  agentName: string;
  onAct: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1 };

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" as const, border: "border-l-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", badge: "secondary" as const, border: "border-l-amber-500" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", badge: "outline" as const, border: "border-l-blue-500" },
};

function extractAmount(title: string): number {
  const match = title.match(/\$[\d,]+(?:\.\d+)?/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/[$,]/g, ""));
}

export function GroupedSuggestionCard({ customerName, suggestions, agentName, onAct, onSnooze, onDismiss }: GroupedSuggestionCardProps) {
  const [open, setOpen] = useState(false);

  const highestSeverity = suggestions.reduce((best, s) => {
    return (severityRank[s.severity] ?? 0) > (severityRank[best] ?? 0) ? s.severity : best;
  }, "info");

  const config = severityConfig[highestSeverity as keyof typeof severityConfig] ?? severityConfig.info;
  const Icon = config.icon;
  const totalAmount = suggestions.reduce((sum, s) => sum + extractAmount(s.title), 0);
  const count = suggestions.length;

  const handleSnoozeAll = () => suggestions.forEach(s => onSnooze(s.id));
  const handleDismissAll = () => suggestions.forEach(s => onDismiss(s.id));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={`border-l-4 transition-all hover:shadow-md ${config.border}`}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${config.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{agentName} suggests</p>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {customerName} — {count} overdue invoices
                  {totalAmount > 0 && ` ($${totalAmount.toLocaleString()})`}
                </p>
              </div>
            </div>
            <Badge variant={config.badge} className="text-[10px] shrink-0">
              {highestSeverity}
            </Badge>
          </div>

          {suggestions[0]?.reason && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Why: </span>{suggestions[0].reason}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {open ? "Hide" : `Show all ${count}`}
              </Button>
            </CollapsibleTrigger>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleSnoozeAll}>
              <Clock className="w-3 h-3" /> Snooze All
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleDismissAll}>
              <XCircle className="w-3 h-3" /> Dismiss All
            </Button>
          </div>

          <CollapsibleContent className="space-y-2 pt-1">
            {suggestions.map((s) => (
              <AgentSuggestionCard
                key={s.id}
                suggestion={s}
                agentName={agentName}
                onAct={onAct}
                onSnooze={onSnooze}
                onDismiss={onDismiss}
              />
            ))}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
