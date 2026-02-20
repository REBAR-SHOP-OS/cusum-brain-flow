import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RCPresenceIndicatorProps {
  status: string;
  dndStatus?: string | null;
  telephonyStatus?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getPresenceColor(status: string, dndStatus?: string | null): string {
  if (dndStatus === "DoNotAcceptAnyCalls" || dndStatus === "DoNotAcceptDepartmentCalls") {
    return "bg-red-500";
  }
  switch (status) {
    case "Available":
      return "bg-green-500";
    case "Busy":
      return "bg-amber-500";
    case "DoNotDisturb":
      return "bg-red-500";
    case "Offline":
      return "bg-muted-foreground/40";
    default:
      return "bg-muted-foreground/40";
  }
}

function getPresenceLabel(status: string, dndStatus?: string | null, telephonyStatus?: string | null): string {
  const parts: string[] = [];
  parts.push(status);
  if (dndStatus && dndStatus !== "TakeAllCalls") parts.push(`DND: ${dndStatus}`);
  if (telephonyStatus && telephonyStatus !== "NoCall") parts.push(`Phone: ${telephonyStatus}`);
  return parts.join(" · ");
}

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

export function RCPresenceIndicator({ status, dndStatus, telephonyStatus, size = "sm", className }: RCPresenceIndicatorProps) {
  const color = getPresenceColor(status, dndStatus);
  const label = getPresenceLabel(status, dndStatus, telephonyStatus);
  const isActive = status === "Available" || telephonyStatus === "Ringing" || telephonyStatus === "OnHold";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("relative inline-flex shrink-0", className)}>
            <span className={cn("rounded-full", sizeClasses[size], color)} />
            {isActive && (
              <span className={cn("absolute inset-0 rounded-full animate-ping opacity-75", color)} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
