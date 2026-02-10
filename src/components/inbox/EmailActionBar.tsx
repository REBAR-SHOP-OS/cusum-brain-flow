import { Reply, Forward, ReplyAll, Sparkles, Archive, Trash2, MoreHorizontal, CheckSquare, Star, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { SnoozePopover } from "./SnoozePopover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ReplyMode = "reply" | "reply-all" | "forward" | null;

interface EmailActionBarProps {
  activeMode: ReplyMode;
  onModeChange: (mode: ReplyMode) => void;
  onSmartReply: () => void;
  onCreateTask?: () => void;
  drafting: boolean;
  emailId?: string;
  isStarred?: boolean;
  onToggleStar?: () => void;
  onSnooze?: (until: Date) => void;
  onMarkReadUnread?: () => void;
  isUnread?: boolean;
}

export function EmailActionBar({
  activeMode, onModeChange, onSmartReply, onCreateTask, drafting,
  emailId, isStarred, onToggleStar, onSnooze, onMarkReadUnread, isUnread,
}: EmailActionBarProps) {
  const { toast } = useToast();

  const handleArchive = () => {
    toast({ title: "Archived", description: "Email moved to archive." });
  };

  const handleDelete = () => {
    toast({ title: "Deleted", description: "Email moved to trash." });
  };

  const handleMarkReadUnread = async () => {
    if (onMarkReadUnread) {
      onMarkReadUnread();
      return;
    }
    // Fallback: update communications table directly
    if (emailId) {
      const newStatus = isUnread ? "read" : "unread";
      await supabase.from("communications").update({ status: newStatus }).eq("id", emailId);
      toast({ title: isUnread ? "Marked as read" : "Marked as unread" });
    }
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

      {/* Star toggle */}
      {onToggleStar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleStar}
        >
          <Star className={cn("w-4 h-4", isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
        </Button>
      )}

      {/* Snooze */}
      {onSnooze && (
        <SnoozePopover onSnooze={onSnooze}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </Button>
        </SnoozePopover>
      )}

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
          {onCreateTask && (
            <DropdownMenuItem onClick={onCreateTask}>
              <CheckSquare className="w-3.5 h-3.5 mr-2" />
              Create Task
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleMarkReadUnread}>
            <BookOpen className="w-3.5 h-3.5 mr-2" />
            {isUnread ? "Mark as read" : "Mark as unread"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
