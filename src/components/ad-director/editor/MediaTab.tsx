import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Image, Upload, Sparkles, RotateCw, Move, ZoomIn, Palette, Music, ChevronLeft } from "lucide-react";
import type { StoryboardScene, ClipOutput, ScriptSegment } from "@/types/adDirector";

interface MediaTabProps {
  storyboard: StoryboardScene[];
  clips: ClipOutput[];
  segments: ScriptSegment[];
  selectedSceneIndex: number;
  onSelectScene: (idx: number) => void;
}

export function MediaTab({ storyboard, clips, segments, selectedSceneIndex, onSelectScene }: MediaTabProps) {
  const [showProperties, setShowProperties] = useState(false);
  const [trimFrom, setTrimFrom] = useState("0.0");
  const [trimTo, setTrimTo] = useState("5.0");
  const [centerX, setCenterX] = useState(50);
  const [centerY, setCenterY] = useState(50);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [colorHex, setColorHex] = useState("#000000");

  const scene = storyboard[selectedSceneIndex];
  const clip = clips.find(c => c.sceneId === scene?.id);
  const segment = segments.find(s => s.id === scene?.segmentId);

  if (showProperties && scene) {
    return (
      <div className="space-y-4">
        <button onClick={() => setShowProperties(false)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to chapters
        </button>
        <h4 className="text-sm font-semibold">Media Properties</h4>
        <div className="text-xs text-muted-foreground">{scene.objective}</div>

        {/* Trim */}
        <div className="space-y-2">
          <Label className="text-xs">Trim</Label>
          <div className="flex gap-2">
            <Input value={trimFrom} onChange={e => setTrimFrom(e.target.value)} className="h-8 text-xs bg-muted/50" placeholder="From" />
            <Input value={trimTo} onChange={e => setTrimTo(e.target.value)} className="h-8 text-xs bg-muted/50" placeholder="To" />
          </div>
        </div>

        {/* Center Point */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1"><Move className="w-3 h-3" /> Center Point</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-[10px] text-muted-foreground">X</span>
              <Slider value={[centerX]} onValueChange={v => setCenterX(v[0])} min={0} max={100} className="mt-1" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-muted-foreground">Y</span>
              <Slider value={[centerY]} onValueChange={v => setCenterY(v[0])} min={0} max={100} className="mt-1" />
            </div>
          </div>
        </div>

        {/* Position */}
        <div className="space-y-2">
          <Label className="text-xs">Position</Label>
          <div className="flex gap-2">
            <Input type="number" value={posX} onChange={e => setPosX(+e.target.value)} className="h-8 text-xs bg-muted/50" placeholder="X" />
            <Input type="number" value={posY} onChange={e => setPosY(+e.target.value)} className="h-8 text-xs bg-muted/50" placeholder="Y" />
          </div>
        </div>

        {/* Zoom & Rotation */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Zoom</Label>
            <Slider value={[zoom]} onValueChange={v => setZoom(v[0])} min={50} max={200} />
            <span className="text-[10px] text-muted-foreground">{zoom}%</span>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs flex items-center gap-1"><RotateCw className="w-3 h-3" /> Rotation</Label>
            <Slider value={[rotation]} onValueChange={v => setRotation(v[0])} min={-180} max={180} />
            <span className="text-[10px] text-muted-foreground">{rotation}°</span>
          </div>
        </div>

        {/* Color */}
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Palette className="w-3 h-3" /> Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
            <Input value={colorHex} onChange={e => setColorHex(e.target.value)} className="h-8 text-xs bg-muted/50 w-24" />
          </div>
        </div>

        {/* Audio & SFX */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <Label className="text-xs flex items-center gap-1"><Music className="w-3 h-3" /> Audio & SFX</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Upload className="w-3 h-3" /> Upload</Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Music className="w-3 h-3" /> Stock SFX</Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Sparkles className="w-3 h-3" /> Generate</Button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1 h-8 text-xs">Apply</Button>
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">Reset</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Chapters</h4>

      {/* Chapter thumbnails */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {storyboard.map((s, idx) => {
          const c = clips.find(cl => cl.sceneId === s.id);
          const seg = segments.find(sg => sg.id === s.segmentId);
          const isSelected = idx === selectedSceneIndex;
          return (
            <button
              key={s.id}
              onClick={() => { onSelectScene(idx); setShowProperties(true); }}
              className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left ${
                isSelected ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60 hover:bg-muted/20"
              }`}
            >
              <div className="w-16 h-10 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground flex-shrink-0 relative overflow-hidden">
                {c?.videoUrl ? (
                  <video src={c.videoUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <Image className="w-4 h-4" />
                )}
                <Badge variant="secondary" className="absolute bottom-0.5 right-0.5 text-[8px] px-1 py-0 h-3.5">
                  {seg ? `${(seg.endTime - seg.startTime).toFixed(0)}s` : "--"}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{s.objective || `Scene ${idx + 1}`}</div>
                <div className="text-[10px] text-muted-foreground truncate">{seg?.text?.slice(0, 50)}</div>
              </div>
              <Badge variant={c?.status === "completed" ? "default" : "secondary"} className="text-[9px] flex-shrink-0">
                {c?.status || "idle"}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Replace media */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <Label className="text-xs text-muted-foreground">Replace media</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1"><Upload className="w-3 h-3" /> Upload</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1"><Image className="w-3 h-3" /> Stock</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1"><Sparkles className="w-3 h-3" /> Generate</Button>
        </div>
      </div>
    </div>
  );
}
