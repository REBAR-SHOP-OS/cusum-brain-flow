import { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  SortAsc,
  FileText,
  Tags,
  Loader2,
  Wand2,
  Archive,
  MailX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type AIAction =
  | "summarize"
  | "detect-spam"
  | "clean"
  | "prioritize"
  | "label-all"
  | "archive-marketing"
  | "unsubscribe";

interface InboxAIToolbarProps {
  emailCount: number;
  onAction: (action: AIAction) => Promise<void>;
}

const AI_BUTTONS: { action: AIAction; label: string; shortLabel: string; icon: typeof FileText; iconColor: string }[] = [
  { action: "summarize", label: "Summarize", shortLabel: "Sum", icon: FileText, iconColor: "text-primary" },
  { action: "detect-spam", label: "Detect Spam", shortLabel: "Spam", icon: ShieldCheck, iconColor: "text-destructive" },
  { action: "label-all", label: "Auto-Label", shortLabel: "Label", icon: Tags, iconColor: "text-accent-foreground" },
  { action: "prioritize", label: "Prioritize", shortLabel: "Sort", icon: SortAsc, iconColor: "text-warning" },
];

export function InboxAIToolbar({ emailCount, onAction }: InboxAIToolbarProps) {
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const { toast } = useToast();

  const handleAction = async (action: AIAction, label: string) => {
    setActiveAction(action);
    try {
      await onAction(action);
      toast({ title: `${label} complete`, description: `Processed ${emailCount} emails.` });
    } catch (err) {
      toast({
        title: `${label} failed`,
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const isLoading = activeAction !== null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {AI_BUTTONS.map(({ action, label, icon: Icon, iconColor }) => (
        <Tooltip key={action}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={isLoading}
              onClick={() => handleAction(action, label)}
            >
              {activeAction === action ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
        </Tooltip>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isLoading}>
                <Wand2 className="w-3.5 h-3.5 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">More AI</TooltipContent>
          </Tooltip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleAction("clean", "Clean Inbox")}>
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Clean Inbox
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction("archive-marketing", "Archive Marketing")}>
            <Archive className="w-3.5 h-3.5 mr-2" />
            Archive Marketing
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAction("unsubscribe", "Unsubscribe Suggestions")}>
            <MailX className="w-3.5 h-3.5 mr-2" />
            Suggest Unsubscribes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
