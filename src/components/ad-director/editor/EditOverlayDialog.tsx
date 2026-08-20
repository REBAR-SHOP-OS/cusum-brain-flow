import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VideoOverlay } from "@/types/videoOverlay";

interface EditOverlayDialogProps {
  open: boolean;
  overlay: VideoOverlay | null;
  onSave: (id: string, newContent: string) => void;
  onClose: () => void;
}

export function EditOverlayDialog({ open, overlay, onSave, onClose }: EditOverlayDialogProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (overlay) setText(overlay.content);
  }, [overlay]);

  const handleSave = () => {
    if (!overlay || !text.trim()) return;
    onSave(overlay.id, text.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Subtitle Text</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">Current: "{overlay?.content}"</p>
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter new text…"
            className="text-sm"
            autoFocus
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!text.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
