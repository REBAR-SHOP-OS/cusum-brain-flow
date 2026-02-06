import { cn } from "@/lib/utils";
import { 
  Search, 
  Layers, 
  Settings2, 
  Ruler, 
  CheckSquare,
  Calculator,
  Scissors,
  Scale,
  FileText,
  Grid
} from "lucide-react";

export interface CalStep {
  id: string;
  number: string;
  name: string;
  shortName: string;
  icon: React.ElementType;
  description: string;
}

export const CHANGY_STEPS: CalStep[] = [
  { id: "1", number: "1", name: "Scope ID (3+3 Scan)", shortName: "Scope ID", icon: Search, description: "Identify all structural elements" },
  { id: "2", number: "2", name: "Classification", shortName: "Classify", icon: Layers, description: "New vs Existing elements" },
  { id: "2.5", number: "2.5", name: "Rebar Type", shortName: "Rebar Type", icon: Settings2, description: "Grades, sizes, coating" },
  { id: "3", number: "3", name: "Measurement/Scale", shortName: "Scale", icon: Ruler, description: "Calculate scales & measurements" },
  { id: "4", number: "4", name: "Dimensions/Verification", shortName: "Dimensions", icon: CheckSquare, description: "Verify actual dimensions" },
  { id: "5", number: "5", name: "Quantity/Spacing", shortName: "Quantity", icon: Calculator, description: "Calculate piece counts" },
  { id: "5.5", number: "5.5", name: "Optimization/Overlap", shortName: "Overlap", icon: Scissors, description: "Calculate overlaps & waste" },
  { id: "6", number: "6", name: "Weight Calculation", shortName: "Weight", icon: Scale, description: "Convert lengths to weights" },
  { id: "7", number: "7", name: "Final Summary", shortName: "Summary", icon: FileText, description: "Consolidate all weights" },
  { id: "8", number: "8", name: "WWM Takeoff", shortName: "WWM", icon: Grid, description: "Wire mesh takeoff" },
];

interface CalStepProgressProps {
  currentStep: string | null;
  completedSteps: string[];
}

export function CalStepProgress({ currentStep, completedSteps }: CalStepProgressProps) {
  return (
    <div className="border-b border-border bg-card/50 overflow-x-auto">
      <div className="flex items-center gap-1 p-3 min-w-max">
        {CHANGY_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isPending = !isCompleted && !isCurrent;
          
          return (
            <div key={step.id} className="flex items-center">
              {/* Step indicator */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    isCompleted && "bg-primary/20 text-primary",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isPending && "bg-muted text-muted-foreground"
                  )}
                >
                  <step.icon className="w-4 h-4" />
                </div>
                <span 
                  className={cn(
                    "text-[10px] font-medium text-center whitespace-nowrap max-w-[60px] truncate",
                    isCurrent && "text-primary",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.number}
                </span>
              </div>
              
              {/* Connector line */}
              {index < CHANGY_STEPS.length - 1 && (
                <div 
                  className={cn(
                    "w-4 h-0.5 mx-1",
                    isCompleted ? "bg-primary/40" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalStepCard({ step, isActive }: { step: CalStep; isActive: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border transition-all",
        isActive
          ? "bg-primary/10 border-primary/30"
          : "bg-muted/50 border-border"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        <step.icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Step {step.number}</span>
          <span className="text-sm font-medium">{step.name}</span>
        </div>
        <p className="text-xs text-muted-foreground">{step.description}</p>
      </div>
    </div>
  );
}

// Helper function to detect current step from message content
export function detectStepFromMessage(content: string): string | null {
  const stepPatterns: { pattern: RegExp; step: string }[] = [
    { pattern: /step\s*1|scope\s*(id|identification)|3\+3\s*scan/i, step: "1" },
    { pattern: /step\s*2(?!\.5)|classification|new\s*(vs|or)\s*existing/i, step: "2" },
    { pattern: /step\s*2\.5|rebar\s*type|grades?\s*(and|,)\s*sizes?/i, step: "2.5" },
    { pattern: /step\s*3|measurement|scale\s*calculation/i, step: "3" },
    { pattern: /step\s*4|dimension|verification/i, step: "4" },
    { pattern: /step\s*5(?!\.5)|quantity|spacing|piece\s*count/i, step: "5" },
    { pattern: /step\s*5\.5|optimization|overlap/i, step: "5.5" },
    { pattern: /step\s*6|weight\s*calculation/i, step: "6" },
    { pattern: /step\s*7|final\s*summary|consolidate/i, step: "7" },
    { pattern: /step\s*8|wwm|wire\s*mesh/i, step: "8" },
  ];

  for (const { pattern, step } of stepPatterns) {
    if (pattern.test(content)) {
      return step;
    }
  }
  return null;
}

// Helper to get all completed steps from message history
export function getCompletedSteps(messages: { content: string; role: string }[]): string[] {
  const completed = new Set<string>();
  const stepOrder = ["1", "2", "2.5", "3", "4", "5", "5.5", "6", "7", "8"];
  
  for (const msg of messages) {
    if (msg.role === "agent") {
      const step = detectStepFromMessage(msg.content);
      if (step) {
        // Mark this step and all previous steps as completed
        const stepIndex = stepOrder.indexOf(step);
        for (let i = 0; i < stepIndex; i++) {
          completed.add(stepOrder[i]);
        }
      }
    }
  }
  
  return Array.from(completed);
}
