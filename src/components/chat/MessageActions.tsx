import { useState } from "react";
import { Copy, RefreshCw, ThumbsUp, ThumbsDown, Brain, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AddToTaskButton } from "@/components/shared/AddToTaskButton";
import { CreateTaskDialog, type CreateTaskDefaults } from "@/components/shared/CreateTaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

interface MessageActionsProps {
  content: string;
  messageId: string;
  onRegenerate?: () => void;
}

export function MessageActions({ content, messageId, onRegenerate }: MessageActionsProps) {
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [liked, setLiked] = useState<"up" | "down" | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleAddToBrain = async () => {
    if (!companyId) {
      toast({ title: "Still loading workspace, try again", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("knowledge").insert({
        title: content.slice(0, 80),
        content,
        category: "agent-response",
        company_id: companyId,
      });
      if (error) throw error;
      toast({ title: "Saved to Brain" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const taskDefaults: CreateTaskDefaults = {
    title: content.slice(0, 80),
    description: content.slice(0, 300),
    source: "agent-chat",
    sourceRef: messageId,
  };

  const actions = [
    {
      icon: Copy,
      label: "Copy",
      onClick: handleCopy,
      active: false,
    },
    {
      icon: RefreshCw,
      label: "Regenerate",
      onClick: onRegenerate,
      active: false,
    },
    {
      icon: ThumbsUp,
      label: "Like",
      onClick: () => setLiked(liked === "up" ? null : "up"),
      active: liked === "up",
    },
    {
      icon: ThumbsDown,
      label: "Dislike",
      onClick: () => setLiked(liked === "down" ? null : "down"),
      active: liked === "down",
    },
    {
      icon: Brain,
      label: "Add to Brain",
      onClick: handleAddToBrain,
      active: false,
    },
    {
      icon: CheckSquare,
      label: "Add to Task",
      onClick: () => setTaskOpen(true),
      active: false,
    },
  ];

  return (
    <>
      <div className="flex items-center gap-0.5 mt-1">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            title={action.label}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              action.active
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <action.icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} defaults={taskDefaults} />
    </>
  );
}
