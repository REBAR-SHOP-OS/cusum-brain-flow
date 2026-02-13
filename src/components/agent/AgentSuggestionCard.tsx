import React, { useState } from "react";
import { AlertTriangle, Info, XCircle, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentSuggestion } from "@/hooks/useAgentSuggestions";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AgentSuggestionCardProps {
  suggestion: AgentSuggestion;
  agentName: string;
  onAct: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" as const, border: "border-l-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", badge: "secondary" as const, border: "border-l-amber-500" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", badge: "outline" as const, border: "border-l-blue-500" },
};

async function resolveCustomerIdFromInvoice(entityId: string): Promise<string | null> {
  const { data } = await supabase
    .from("accounting_mirror")
    .select("customer_id")
    .eq("id", entityId)
    .maybeSingle();
  return data?.customer_id ?? null;
}

export const AgentSuggestionCard = React.forwardRef<HTMLDivElement, AgentSuggestionCardProps>(function AgentSuggestionCard({ suggestion, agentName, onAct, onSnooze, onDismiss }, ref) {
  const navigate = useNavigate();
  const [acting, setActing] = useState(false);
  const config = severityConfig[suggestion.severity as keyof typeof severityConfig] ?? severityConfig.info;
  const Icon = config.icon;

  const actions = suggestion.actions as { label: string; action: string; path?: string }[] | null;
  const primaryAction = actions?.[0];

  const handleAct = async () => {
    // For invoice suggestions, resolve customer and navigate to customer-action page
    if (suggestion.entity_type === "invoice" && suggestion.entity_id) {
      setActing(true);
      try {
        const customerId = await resolveCustomerIdFromInvoice(suggestion.entity_id);
        if (customerId) {
          onAct(suggestion.id);
          navigate(`/customer-action/${customerId}?invoice=${suggestion.entity_id}`);
          return;
        }
      } catch (e) {
        console.error("Failed to resolve customer:", e);
      } finally {
        setActing(false);
      }
    }

    // Fallback: existing navigation behavior
    if (primaryAction?.action === "navigate" && primaryAction.path) {
      navigate(primaryAction.path);
    }
    onAct(suggestion.id);
  };

  return (
    <Card ref={ref} className={`border-l-4 transition-all hover:shadow-md ${config.border}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${config.bg}`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{agentName} suggests</p>
              <p className="text-sm font-semibold text-foreground leading-tight">{suggestion.title}</p>
            </div>
          </div>
          <Badge variant={config.badge} className="text-[10px] shrink-0">
            {suggestion.severity}
          </Badge>
        </div>

        {suggestion.reason && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Why: </span>{suggestion.reason}
          </p>
        )}

        {suggestion.impact && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Impact: </span>{suggestion.impact}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleAct} disabled={acting}>
            <Zap className="w-3 h-3" />
            {acting ? "Loading..." : (primaryAction?.label ?? "Act")}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onSnooze(suggestion.id)}>
            <Clock className="w-3 h-3" /> Snooze
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => onDismiss(suggestion.id)}>
            <XCircle className="w-3 h-3" /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
AgentSuggestionCard.displayName = "AgentSuggestionCard";
