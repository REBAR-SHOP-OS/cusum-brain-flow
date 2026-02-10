import { useState } from "react";
import { Copy, Brain, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { CreateTaskDialog, type CreateTaskDefaults } from "./CreateTaskDialog";

interface ContentActionsProps {
  content: string;
  title?: string;
  size?: "sm" | "xs";
  source?: string;
  sourceRef?: string;
  className?: string;
}

export function ContentActions({
  content,
  title,
  size = "sm",
  source = "conversation",
  sourceRef,
  className,
}: ContentActionsProps) {
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [taskOpen, setTaskOpen] = useState(false);

  const iconSize = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "xs" ? "p-1" : "p-1.5";

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
        title: (title || content.slice(0, 80)).slice(0, 80),
        content,
        category: "saved-content",
        company_id: companyId,
      });
      if (error) throw error;
      toast({ title: "Saved to Brain" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const taskDefaults: CreateTaskDefaults = {
    title: (title || content.slice(0, 80)).slice(0, 80),
    description: content.slice(0, 300),
    source,
    sourceRef: sourceRef || "",
  };

  const actions = [
    { icon: Copy, label: "Copy", onClick: handleCopy },
    { icon: Brain, label: "Add to Brain", onClick: handleAddToBrain },
    { icon: CheckSquare, label: "Add to Task", onClick: () => setTaskOpen(true) },
  ];

  return (
    <>
      <div className={cn("flex items-center gap-0.5", className)}>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            title={action.label}
            className={cn(
              "rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted",
              btnSize
            )}
          >
            <action.icon className={iconSize} />
          </button>
        ))}
      </div>
      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} defaults={taskDefaults} />
    </>
  );
}
