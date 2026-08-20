import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";
import type { StoryboardScene } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";

interface ImageOverlayDialogProps {
  open: boolean;
  onClose: () => void;
  storyboard: StoryboardScene[];
  selectedSceneIndex: number;
  onAdd: (overlay: VideoOverlay) => void;
}

export function ImageOverlayDialog({ open, onClose, storyboard, selectedSceneIndex, onAdd }: ImageOverlayDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;

    const url = URL.createObjectURL(file);
    onAdd({
      id: crypto.randomUUID(),
      kind: "image",
      position: { x: 25, y: 25 },
      size: { w: 30, h: 30 },
      content: url,
      opacity: 1,
      sceneId: scene.id,
      animated: false,
    });
    e.target.value = "";
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Add Image to Video</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-center">
          <p className="text-[11px] text-muted-foreground">
            Image will be placed on scene {selectedSceneIndex + 1}. Drag to reposition after adding.
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="w-4 h-4 mr-2" /> Select Image
          </Button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
