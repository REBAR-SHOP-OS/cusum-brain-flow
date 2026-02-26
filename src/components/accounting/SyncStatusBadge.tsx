import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

interface SyncStatusBadgeProps {
  status?: "synced" | "pending" | "error" | null;
  lastSyncedAt?: string | null;
  errorMessage?: string | null;
}

export function SyncStatusBadge({ status, lastSyncedAt, errorMessage }: SyncStatusBadgeProps) {
  if (!status) return null;

  const config = {
    synced: {
      icon: CheckCircle,
      label: "Synced",
      className: "bg-success/10 text-success border-0",
    },
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-warning/10 text-warning border-0",
    },
    error: {
      icon: AlertCircle,
      label: "Error",
      className: "bg-destructive/10 text-destructive border-0",
    },
  }[status];

  const Icon = config.icon;
  const tooltipText = errorMessage
    ? `Error: ${errorMessage}`
    : lastSyncedAt
    ? `Last synced: ${new Date(lastSyncedAt).toLocaleString()}`
    : config.label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${config.className} text-xs gap-1 cursor-default`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
