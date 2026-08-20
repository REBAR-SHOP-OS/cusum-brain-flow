import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, RotateCcw } from "lucide-react";
import type { Notification } from "@/hooks/useNotifications";

interface FeedbackReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Notification | null;
  onConfirm: (id: string) => void;
  onReReport: (item: Notification, comment: string) => void;
}

export function FeedbackReviewDialog({ open, onOpenChange, item, onConfirm, onReReport }: FeedbackReviewDialogProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;

  const meta = item.metadata as Record<string, unknown> | null;
  const title = (meta?.original_title as string) || item.title;
  const description = (meta?.original_description as string) || item.description || "";
  const screenshotUrl = (meta?.original_attachment_url as string) || null;

  const handleConfirm = () => {
    onConfirm(item.id);
    onOpenChange(false);
    setComment("");
  };

  const handleReReport = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await onReReport(item, comment.trim());
      onOpenChange(false);
      setComment("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">بررسی بازخورد</DialogTitle>
          <DialogDescription className="sr-only">بررسی و تایید یا رد بازخورد</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original title */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">عنوان</p>
            <p className="text-sm font-semibold">{title}</p>
          </div>

          {/* Screenshot */}
          {screenshotUrl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">اسکرین‌شات</p>
              <img
                src={screenshotUrl}
                alt="Screenshot"
                className="w-full rounded-md border border-border object-contain max-h-60"
              />
            </div>
          )}

          {/* Description */}
          {description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">توضیحات</p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{description}</p>
            </div>
          )}

          {/* Confirm button */}
          <Button
            onClick={handleConfirm}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="w-4 h-4" />
            مشکل برطرف شده - تأیید
          </Button>

          {/* Separator */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">یا رد کنید</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Reject with comment */}
          <div className="space-y-2">
            <Textarea
              placeholder="نظر شما درباره مشکل..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button
              onClick={handleReReport}
              disabled={!comment.trim() || submitting}
              variant="destructive"
              className="w-full"
            >
              <RotateCcw className="w-4 h-4" />
              گزارش مجدد مشکل
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
