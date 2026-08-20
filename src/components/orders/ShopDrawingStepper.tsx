import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "qc_internal", label: "QC Internal" },
  { key: "sent_to_customer", label: "Sent to Customer" },
  { key: "customer_revision", label: "Customer Revision" },
  { key: "approved", label: "Approved" },
] as const;

interface Props {
  status: string;
  onStatusChange?: (status: string) => void;
  disabled?: boolean;
}

export function ShopDrawingStepper({ status, onStatusChange, disabled }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Shop Drawing Status
      </p>
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isComplete = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isClickable = !disabled && onStatusChange && Math.abs(i - currentIdx) <= 1 && i !== currentIdx;

          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <button
                disabled={!isClickable}
                onClick={() => isClickable && onStatusChange?.(step.key)}
                className={cn(
                  "flex items-center justify-center rounded-full w-7 h-7 text-xs font-bold transition-all shrink-0",
                  isComplete && "bg-emerald-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !isComplete && !isCurrent && "bg-muted text-muted-foreground",
                  isClickable && "cursor-pointer hover:ring-2 hover:ring-primary/40",
                  !isClickable && "cursor-default"
                )}
              >
                {isComplete ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 rounded-full",
                    i < currentIdx ? "bg-emerald-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between">
        {STEPS.map((step) => (
          <span
            key={step.key}
            className={cn(
              "text-[9px] text-center flex-1",
              step.key === status ? "text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
