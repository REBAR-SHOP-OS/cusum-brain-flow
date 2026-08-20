import { useState } from "react";
import {
  ShoppingCart, UserPlus, TrendingUp, Star, Cake,
  Bell, Crown, RotateCcw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailAutomations, type EmailAutomation } from "@/hooks/useEmailAutomations";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  abandoned_cart: ShoppingCart,
  welcome_series: UserPlus,
  upsell_email: TrendingUp,
  review_request: Star,
  birthday_promo: Cake,
  price_stock_alert: Bell,
  vip_email: Crown,
  winback: RotateCcw,
};

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

function AutomationCard({ automation }: { automation: EmailAutomation }) {
  const [expanded, setExpanded] = useState(false);
  const { toggleAutomation } = useEmailAutomations();
  const Icon = iconMap[automation.automation_key] || Bell;

  const configEntries = Object.entries(automation.config || {}).filter(
    ([, v]) => v !== null && v !== undefined
  );

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer hover:shadow-md",
        automation.enabled ? "border-primary/30" : "opacity-75"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            automation.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{automation.name}</h3>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityStyles[automation.priority])}>
                {automation.priority}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{automation.description}</p>

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{automation.campaigns_generated} generated</span>
              {automation.last_triggered_at && (
                <span>Last: {new Date(automation.last_triggered_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={automation.enabled}
              onCheckedChange={(checked) => {
                toggleAutomation.mutate({ id: automation.id, enabled: checked });
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && configEntries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Configuration</p>
            <div className="grid grid-cols-2 gap-2">
              {configEntries.map(([key, val]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground">{key.replace(/_/g, " ")}:</span>{" "}
                  <span className="font-medium">{JSON.stringify(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AutomationsPanel() {
  const { automations, isLoading } = useEmailAutomations();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">
          {enabledCount} of {automations.length} automations active
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {automations.map((a) => (
          <AutomationCard key={a.id} automation={a} />
        ))}
      </div>
    </div>
  );
}
