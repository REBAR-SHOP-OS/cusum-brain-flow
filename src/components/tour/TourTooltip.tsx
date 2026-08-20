import type { TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Rocket, PartyPopper } from "lucide-react";

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
  const isWelcome = index === 0;
  const isFinale = isLastStep;

  return (
    <div
      {...tooltipProps}
      className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-[380px] animate-scale-in overflow-hidden"
    >
      {/* Animated progress bar */}
      <div className="h-2 bg-muted relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
        {/* Shimmer effect */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]"
          style={{ width: "30%" }}
        />
      </div>

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-primary uppercase">
              Training
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {index + 1}/{size}
            </span>
          </div>
          <button
            {...closeProps}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title with optional celebration */}
        {step.title && (
          <h3 className="text-xl font-bold text-foreground mb-3 leading-tight">
            {isFinale && <PartyPopper className="w-5 h-5 inline mr-2 text-warning" />}
            {step.title as string}
          </h3>
        )}

        {/* Content — preserves newlines for multi-line instructions */}
        <div className="text-sm text-muted-foreground leading-relaxed mb-6 whitespace-pre-line">
          {step.content as string}
        </div>

        {/* Step dots visualization */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {Array.from({ length: Math.min(size, 20) }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < index + 1
                  ? "bg-primary w-3"
                  : i === index + 1
                  ? "bg-primary/40 w-2"
                  : "bg-muted w-1.5"
              }`}
            />
          ))}
          {size > 20 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              +{size - 20}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {index === 0 ? (
            <Button
              variant="ghost"
              size="sm"
              {...skipProps}
              className="text-xs text-muted-foreground mr-auto"
            >
              Skip training
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                {...skipProps}
                className="text-xs text-muted-foreground mr-auto"
              >
                End tour
              </Button>
              <Button variant="outline" size="sm" {...backProps}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            </>
          )}
          {continuous && (
            <Button
              size="sm"
              {...primaryProps}
              className={`ml-auto gap-1.5 ${
                isWelcome
                  ? "bg-primary text-primary-foreground px-6"
                  : isFinale
                  ? "bg-primary text-primary-foreground px-6"
                  : ""
              }`}
            >
              {isWelcome ? (
                <>
                  Start Training <Rocket className="w-3.5 h-3.5" />
                </>
              ) : isFinale ? (
                <>
                  Let's Go! <PartyPopper className="w-3.5 h-3.5" />
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
