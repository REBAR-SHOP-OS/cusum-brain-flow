import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowRight, Mail, BarChart3, AlertTriangle, Calendar,
  Check, X, Loader2, Sparkles, CheckCheck, XCircle,
} from "lucide-react";
import type { PipelineAIAction } from "@/hooks/usePipelineAI";

const ACTION_ICONS: Record<string, React.ElementType> = {
  move_stage: ArrowRight,
  send_followup: Mail,
  score_update: BarChart3,
  flag_stale: AlertTriangle,
  set_reminder: Calendar,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/30",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

interface PipelineAIActionsProps {
  actions: PipelineAIAction[];
  isLoading: boolean;
  isScanning: boolean;
  onScan: () => void;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  onApproveAll: () => void;
  onDismissAll: () => void;
  onExecuteAction: (action: PipelineAIAction) => void;
}

export function PipelineAIActions({
  actions,
  isLoading,
  isScanning,
  onScan,
  onApprove,
  onDismiss,
  onApproveAll,
  onDismissAll,
  onExecuteAction,
}: PipelineAIActionsProps) {
  const pending = actions.filter((a) => a.status === "pending");
  const approved = actions.filter((a) => a.status === "approved");

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">AI Autopilot</h3>
            {pending.length > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {pending.length}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onScan}
            disabled={isScanning}
          >
            {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Scan
          </Button>
        </div>

        {pending.length > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-6 text-xs flex-1 gap-1" onClick={onApproveAll}>
              <CheckCheck className="w-3 h-3" /> Approve All
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs flex-1 gap-1" onClick={onDismissAll}>
              <XCircle className="w-3 h-3" /> Dismiss All
            </Button>
          </div>
        )}
      </div>

      {/* Actions list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && pending.length === 0 && approved.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No pending AI actions.</p>
              <p className="mt-1">Click "Scan" to analyze your pipeline.</p>
            </div>
          )}

          {/* Pending actions */}
          {pending.map((action) => (
            <AIActionCard
              key={action.id}
              action={action}
              onApprove={() => onApprove(action.id)}
              onDismiss={() => onDismiss(action.id)}
            />
          ))}

          {/* Approved (ready to execute) */}
          {approved.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-1 pt-2">Ready to Execute</p>
              {approved.map((action) => (
                <AIActionCard
                  key={action.id}
                  action={action}
                  onExecute={() => onExecuteAction(action)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function AIActionCard({
  action,
  onApprove,
  onDismiss,
  onExecute,
}: {
  action: PipelineAIAction;
  onApprove?: () => void;
  onDismiss?: () => void;
  onExecute?: () => void;
}) {
  const Icon = ACTION_ICONS[action.action_type] || Sparkles;
  const leadTitle = action.leads?.title || "Unknown Lead";
  const priorityClass = PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.medium;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2.5 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium leading-tight truncate">{leadTitle}</p>
            <Badge variant="outline" className={`text-[10px] h-4 px-1 mt-0.5 ${priorityClass}`}>
              {action.priority}
            </Badge>
          </div>
        </div>

        {action.ai_reasoning && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
            {action.ai_reasoning}
          </p>
        )}

        <div className="flex gap-1.5 pt-0.5">
          {action.status === "pending" && onApprove && onDismiss && (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-6 text-xs flex-1 gap-1"
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
              >
                <Check className="w-3 h-3" /> Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              >
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
          {action.status === "approved" && onExecute && (
            <Button
              variant="default"
              size="sm"
              className="h-6 text-xs flex-1 gap-1"
              onClick={(e) => { e.stopPropagation(); onExecute(); }}
            >
              <ArrowRight className="w-3 h-3" /> Execute
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
