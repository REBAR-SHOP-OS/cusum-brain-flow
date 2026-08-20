import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StoryboardScene, ScriptSegment } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";

interface TextOverlayDialogProps {
  open: boolean;
  onClose: () => void;
  storyboard: StoryboardScene[];
  segments: ScriptSegment[];
  selectedSceneIndex: number;
  onAdd: (overlay: VideoOverlay) => void;
}

const POSITIONS = [
  { label: "Top Center", x: 30, y: 5 },
  { label: "Center", x: 25, y: 45 },
  { label: "Bottom Center", x: 25, y: 85 },
] as const;

export function TextOverlayDialog({ open, onClose, storyboard, selectedSceneIndex, onAdd }: TextOverlayDialogProps) {
  const [text, setText] = useState("");
  const [posIdx, setPosIdx] = useState(2);

  const handleAdd = () => {
    if (!text.trim()) return;
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;
    const pos = POSITIONS[posIdx];
    onAdd({
      id: crypto.randomUUID(),
      kind: "text",
      position: { x: pos.x, y: pos.y },
      size: { w: 50, h: 10 },
      content: text.trim(),
      opacity: 0.95,
      sceneId: scene.id,
      animated: true,
    });
    setText("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Add Text Overlay</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter text…"
            className="text-sm"
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <div className="flex gap-2">
            {POSITIONS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPosIdx(i)}
                className={`flex-1 text-[10px] py-1.5 rounded border transition-colors
                  ${i === posIdx ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Scene {selectedSceneIndex + 1} of {storyboard.length}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={!text.trim()}>Add Text</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
