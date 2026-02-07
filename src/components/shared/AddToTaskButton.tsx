import { useState } from "react";
import { CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog, type CreateTaskDefaults } from "./CreateTaskDialog";

interface AddToTaskButtonProps {
  defaults: CreateTaskDefaults;
  variant?: "full" | "icon";
  className?: string;
}

export function AddToTaskButton({ defaults, variant = "full", className }: AddToTaskButtonProps) {
  const [open, setOpen] = useState(false);

  if (variant === "icon") {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onClick={() => setOpen(true)}
          title="Add to Tasks"
        >
          <CheckSquare className="w-4 h-4" />
        </Button>
        <CreateTaskDialog open={open} onOpenChange={setOpen} defaults={defaults} />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 ${className || ""}`}
        onClick={() => setOpen(true)}
      >
        <CheckSquare className="w-4 h-4 text-primary" />
        Add to Tasks
      </Button>
      <CreateTaskDialog open={open} onOpenChange={setOpen} defaults={defaults} />
    </>
  );
}
