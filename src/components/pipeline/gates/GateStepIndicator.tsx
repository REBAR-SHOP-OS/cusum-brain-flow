import { cn } from "@/lib/utils";

interface GateStepIndicatorProps {
  current: number; // 0-indexed
  total: number;
}

export function GateStepIndicator({ current, total }: GateStepIndicatorProps) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs text-muted-foreground font-medium">
        Step {current + 1} of {total}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-6 rounded-full transition-colors",
              i <= current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
