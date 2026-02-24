import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: string[];
  variant?: "default" | "destructive";
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  variant = "default",
  confirmLabel = "Yes, Confirm",
  onConfirm,
  loading,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3 text-xl">
            {variant === "destructive" ? (
              <AlertTriangle className="w-7 h-7 text-destructive" />
            ) : (
              <CheckCircle2 className="w-7 h-7 text-primary" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed">
            {description}
          </AlertDialogDescription>
          {details && details.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-muted space-y-1">
              {details.map((d, i) => (
                <p key={i} className="text-sm font-medium text-foreground">{d}</p>
              ))}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 mt-4">
          <AlertDialogCancel className="h-12 text-base px-6">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={loading}
            variant={variant === "destructive" ? "destructive" : "default"}
            className="h-12 text-base px-6"
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
