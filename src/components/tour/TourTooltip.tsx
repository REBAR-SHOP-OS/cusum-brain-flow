import type { TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, ChevronRight, ChevronLeft, Rocket } from "lucide-react";

export function TourTooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  size,
  isLastStep,
}: TooltipRenderProps) {
  const progress = ((index + 1) / size) * 100;

  return (
    <div
      {...tooltipProps}
      className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-[340px] animate-scale-in overflow-hidden"
    >
      {/* Progress bar at top */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-5">
        {/* Step counter */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-muted-foreground">
            {index + 1} / {size}
          </span>
          <button
            {...closeProps}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        {step.title && (
          <h3 className="text-lg font-bold text-foreground mb-2 leading-tight">
            {step.title as string}
          </h3>
        )}

        {/* Content */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          {step.content as string}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {index === 0 && (
            <Button
              variant="ghost"
              size="sm"
              {...skipProps}
              className="text-xs text-muted-foreground mr-auto"
            >
              Skip tour
            </Button>
          )}
          {index > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                {...skipProps}
                className="text-xs text-muted-foreground mr-auto"
              >
                Skip
              </Button>
              <Button variant="outline" size="sm" {...backProps}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            </>
          )}
          {continuous && (
            <Button size="sm" {...primaryProps} className="ml-auto gap-1.5">
              {isLastStep ? (
                <>
                  Let's Go! <Rocket className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
