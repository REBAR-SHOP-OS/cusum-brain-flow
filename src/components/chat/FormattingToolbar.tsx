import { Bold, Italic, Code, List, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FormattingAction {
  id: string;
  icon: React.ElementType;
  label: string;
  prefix: string;
  suffix: string;
}

const actions: FormattingAction[] = [
  { id: "bold", icon: Bold, label: "Bold", prefix: "**", suffix: "**" },
  { id: "italic", icon: Italic, label: "Italic", prefix: "_", suffix: "_" },
  { id: "code", icon: Code, label: "Code", prefix: "`", suffix: "`" },
  { id: "list", icon: List, label: "List", prefix: "\n- ", suffix: "" },
  { id: "link", icon: Link2, label: "Link", prefix: "[", suffix: "](url)" },
];

interface FormattingToolbarProps {
  onFormat: (prefix: string, suffix: string) => void;
  disabled?: boolean;
  visible: boolean;
}

export function FormattingToolbar({ onFormat, disabled, visible }: FormattingToolbarProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/50 animate-in fade-in slide-in-from-bottom-1 duration-150">
      {actions.map((action) => (
        <Tooltip key={action.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onFormat(action.prefix, action.suffix)}
              disabled={disabled}
              className={cn(
                "p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <action.icon className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{action.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
