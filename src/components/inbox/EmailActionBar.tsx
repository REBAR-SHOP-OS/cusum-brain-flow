import { Reply, Forward, ReplyAll, Sparkles, Archive, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export type ReplyMode = "reply" | "reply-all" | "forward" | null;

interface EmailActionBarProps {
  activeMode: ReplyMode;
  onModeChange: (mode: ReplyMode) => void;
  onSmartReply: () => void;
  drafting: boolean;
}

export function EmailActionBar({ activeMode, onModeChange, onSmartReply, drafting }: EmailActionBarProps) {
  const { toast } = useToast();

  const handleArchive = () => {
    toast({ title: "Archived", description: "Email moved to archive." });
  };

  const handleDelete = () => {
    toast({ title: "Deleted", description: "Email moved to trash." });
  };

  return (
    <div className="flex items-center gap-1 p-3 border-b bg-muted/20">
      <Button
        variant={activeMode === "reply" ? "secondary" : "ghost"}
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => onModeChange(activeMode === "reply" ? null : "reply")}
      >
        <Reply className="w-3.5 h-3.5" />
        Reply
      </Button>

      <Button
        variant={activeMode === "reply-all" ? "secondary" : "ghost"}
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => onModeChange(activeMode === "reply-all" ? null : "reply-all")}
      >
        <ReplyAll className="w-3.5 h-3.5" />
        Reply All
      </Button>

      <Button
        variant={activeMode === "forward" ? "secondary" : "ghost"}
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => onModeChange(activeMode === "forward" ? null : "forward")}
      >
        <Forward className="w-3.5 h-3.5" />
        Forward
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-primary"
        onClick={onSmartReply}
        disabled={drafting}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Smart Reply
      </Button>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleArchive}>
        <Archive className="w-4 h-4 text-muted-foreground" />
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
        <Trash2 className="w-4 h-4 text-muted-foreground" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => toast({ title: "Marked as unread" })}>
            Mark as unread
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast({ title: "Snoozed" })}>
            Snooze
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast({ title: "Starred" })}>
            Star
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
