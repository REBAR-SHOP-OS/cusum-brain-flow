import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Captions } from "lucide-react";
import type { VideoOverlay } from "@/types/videoOverlay";

interface SubtitleDialogProps {
  open: boolean;
  onClose: () => void;
  sceneId: string;
  onAdd: (overlay: VideoOverlay) => void;
}

export function SubtitleDialog({ open, onClose, sceneId, onAdd }: SubtitleDialogProps) {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim() || !sceneId) return;
    onAdd({
      id: crypto.randomUUID(),
      kind: "text",
      position: { x: 5, y: 85 },
      size: { w: 90, h: 10 },
      content: text.trim(),
      opacity: 0.95,
      sceneId,
      animated: false,
    });
    setText("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Captions className="w-4 h-4" />
            افزودن زیرنویس
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="متن زیرنویس را وارد کنید..."
            className="text-sm min-h-[80px]"
            dir="auto"
          />
          <p className="text-[10px] text-muted-foreground">
            زیرنویس در پایین ویدئو نمایش داده می‌شود
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>انصراف</Button>
          <Button size="sm" onClick={handleAdd} disabled={!text.trim()}>افزودن زیرنویس</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
