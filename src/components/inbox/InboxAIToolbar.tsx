import { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  Trash2,
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
    <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs shrink-0"
        disabled={isLoading}
        onClick={() => handleAction("summarize", "Summarize")}
      >
        {activeAction === "summarize" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-primary" />
        )}
        Summarize
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs shrink-0"
        disabled={isLoading}
        onClick={() => handleAction("detect-spam", "Spam Detection")}
      >
        {activeAction === "detect-spam" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-destructive" />
        )}
        Detect Spam
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs shrink-0"
        disabled={isLoading}
        onClick={() => handleAction("label-all", "Auto-Label")}
      >
        {activeAction === "label-all" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Tags className="w-3.5 h-3.5 text-accent-foreground" />
        )}
        Auto-Label
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs shrink-0"
        disabled={isLoading}
        onClick={() => handleAction("prioritize", "Priority Sort")}
      >
        {activeAction === "prioritize" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <SortAsc className="w-3.5 h-3.5 text-warning" />
        )}
        Prioritize
      </Button>

      <div className="w-px h-5 bg-border mx-1 shrink-0" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs shrink-0" disabled={isLoading}>
            <Wand2 className="w-3.5 h-3.5 text-primary" />
            More AI
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleAction("clean", "Clean Inbox")}>
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Clean Inbox (remove clutter)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction("archive-marketing", "Archive Marketing")}>
            <Archive className="w-3.5 h-3.5 mr-2" />
            Archive all Marketing
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
