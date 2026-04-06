import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowNavFrame = {
  graphId: string;
  title: string;
  parentModuleId?: string;
};

export function LayerBreadcrumb(props: {
  stack: WorkflowNavFrame[];
  onNavigate: (idx: number) => void;
  className?: string;
}) {
  const { stack, onNavigate, className } = props;

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto text-xs text-white/70", className)}>
      {stack.map((f, idx) => {
        const isLast = idx === stack.length - 1;
        return (
          <div key={`${f.graphId}-${idx}`} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className={cn(
                "rounded px-1.5 py-1 transition hover:bg-white/10",
                isLast && "text-white/90 hover:bg-transparent",
              )}
              onClick={() => onNavigate(idx)}
              disabled={isLast}
              title={f.title}
            >
              {f.title}
            </button>
            {!isLast && <ChevronRight className="h-3.5 w-3.5 text-white/35" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

